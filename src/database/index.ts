import initSqlJs from 'sql.js';
import type { Teacher, Lesson, Board, Session, SessionAction, BackupInfo } from '@/types';

let db: initSqlJs.Database | null = null;
const DB_STORE_NAME = 'airtech_db_storage';
const DB_KEY = 'sqlite_binary';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_STORE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('data')) {
        database.createObjectStore('data');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadDbFromStorage(): Promise<Uint8Array | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = idb.transaction('data', 'readonly');
      const store = tx.objectStore('data');
      const req = store.get(DB_KEY);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else if (req.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Could not load from IndexedDB, falling back to memory', err);
    return null;
  }
}

export async function persistDatabase(): Promise<void> {
  if (!db) return;
  try {
    const data = db.export();
    const idb = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction('data', 'readwrite');
      const store = tx.objectStore('data');
      const req = store.put(data, DB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not persist database to IndexedDB', err);
  }
}

export async function initDatabase(): Promise<initSqlJs.Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`
  });

  const savedData = await loadDbFromStorage();
  if (savedData && savedData.length > 0) {
    db = new SQL.Database(savedData);
  } else {
    db = new SQL.Database();
  }

  runMigrations(db);

  // Auto-persist database periodically
  setInterval(() => {
    persistDatabase();
  }, 4000);

  return db;
}

function runMigrations(db: initSqlJs.Database): void {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      face_embedding BLOB,
      face_images TEXT,
      preferences TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      slides TEXT NOT NULL,
      boards TEXT NOT NULL,
      assets TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      page INTEGER NOT NULL,
      strokes TEXT NOT NULL,
      annotations TEXT NOT NULL,
      viewport TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      lesson_id TEXT,
      board_id TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      state TEXT NOT NULL,
      actions TEXT NOT NULL,
      metadata TEXT NOT NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      includes TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON lessons(teacher_id)`,
    `CREATE INDEX IF NOT EXISTS idx_boards_lesson ON boards(lesson_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON sessions(teacher_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_lesson ON sessions(lesson_id)`,
  ];

  for (const migration of migrations) {
    db.exec(migration);
  }
}

export function getDb(): initSqlJs.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function queryOne(sql: string, params?: any[]): any | null {
  if (!db) return null;
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  let result: any = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function queryAll(sql: string, params?: any[]): any[] {
  if (!db) return [];
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function runSql(sql: string, params?: any[]): void {
  if (!db) return;
  const stmt = db.prepare(sql);
  stmt.run(params || []);
  stmt.free();
  persistDatabase();
}

function rowToTeacher(row: any): Teacher {
  let embedding: Float32Array | undefined;
  if (row.face_embedding) {
    if (row.face_embedding instanceof Uint8Array) {
      embedding = new Float32Array(row.face_embedding.buffer, row.face_embedding.byteOffset, row.face_embedding.byteLength / 4);
    } else if (Array.isArray(row.face_embedding)) {
      embedding = new Float32Array(row.face_embedding);
    }
  }

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    subject: row.subject,
    faceEmbedding: embedding,
    faceImages: JSON.parse(row.face_images || '[]'),
    preferences: JSON.parse(row.preferences || '{}'),
    createdAt: new Date(Number(row.created_at)),
    updatedAt: new Date(Number(row.updated_at)),
  };
}

export const TeacherRepository = {
  create(teacher: Teacher): void {
    const embeddingData = teacher.faceEmbedding ? Array.from(teacher.faceEmbedding) : null;
    runSql(`
      INSERT INTO teachers (id, name, code, subject, face_embedding, face_images, preferences, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      teacher.id,
      teacher.name,
      teacher.code,
      teacher.subject,
      embeddingData ? JSON.stringify(embeddingData) : null,
      JSON.stringify(teacher.faceImages || []),
      JSON.stringify(teacher.preferences),
      teacher.createdAt.getTime(),
      teacher.updatedAt.getTime()
    ]);
  },

  getById(id: string): Teacher | null {
    const row = queryOne('SELECT * FROM teachers WHERE id = ?', [id]);
    return row ? rowToTeacher(row) : null;
  },

  getByCode(code: string): Teacher | null {
    const row = queryOne('SELECT * FROM teachers WHERE code = ?', [code]);
    return row ? rowToTeacher(row) : null;
  },

  getAll(): Teacher[] {
    const rows = queryAll('SELECT * FROM teachers ORDER BY created_at DESC');
    return rows.map(rowToTeacher);
  },

  update(teacher: Teacher): void {
    const embeddingData = teacher.faceEmbedding ? Array.from(teacher.faceEmbedding) : null;
    runSql(`
      UPDATE teachers 
      SET name = ?, code = ?, subject = ?, face_embedding = ?, face_images = ?, preferences = ?, updated_at = ?
      WHERE id = ?
    `, [
      teacher.name,
      teacher.code,
      teacher.subject,
      embeddingData ? JSON.stringify(embeddingData) : null,
      JSON.stringify(teacher.faceImages || []),
      JSON.stringify(teacher.preferences),
      teacher.updatedAt.getTime(),
      teacher.id
    ]);
  },

  delete(id: string): void {
    runSql('DELETE FROM teachers WHERE id = ?', [id]);
  },
};

function rowToLesson(row: any): Lesson {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    title: row.title,
    subject: row.subject,
    description: row.description,
    slides: JSON.parse(row.slides || '[]'),
    boards: JSON.parse(row.boards || '[]'),
    assets: JSON.parse(row.assets || '[]'),
    createdAt: new Date(Number(row.created_at)),
    updatedAt: new Date(Number(row.updated_at)),
  };
}

export const LessonRepository = {
  create(lesson: Lesson): void {
    runSql(`
      INSERT INTO lessons (id, teacher_id, title, subject, description, slides, boards, assets, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lesson.id,
      lesson.teacherId,
      lesson.title,
      lesson.subject,
      lesson.description || null,
      JSON.stringify(lesson.slides),
      JSON.stringify(lesson.boards),
      JSON.stringify(lesson.assets),
      lesson.createdAt.getTime(),
      lesson.updatedAt.getTime()
    ]);
  },

  getById(id: string): Lesson | null {
    const row = queryOne('SELECT * FROM lessons WHERE id = ?', [id]);
    return row ? rowToLesson(row) : null;
  },

  getByTeacher(teacherId: string): Lesson[] {
    const rows = queryAll('SELECT * FROM lessons WHERE teacher_id = ? ORDER BY updated_at DESC', [teacherId]);
    return rows.map(rowToLesson);
  },

  getRecent(teacherId: string, limit = 10): Lesson[] {
    const rows = queryAll('SELECT * FROM lessons WHERE teacher_id = ? ORDER BY updated_at DESC LIMIT ?', [teacherId, limit]);
    return rows.map(rowToLesson);
  },

  update(lesson: Lesson): void {
    runSql(`
      UPDATE lessons 
      SET title = ?, subject = ?, description = ?, slides = ?, boards = ?, assets = ?, updated_at = ?
      WHERE id = ?
    `, [
      lesson.title,
      lesson.subject,
      lesson.description || null,
      JSON.stringify(lesson.slides),
      JSON.stringify(lesson.boards),
      JSON.stringify(lesson.assets),
      lesson.updatedAt.getTime(),
      lesson.id
    ]);
  },

  delete(id: string): void {
    runSql('DELETE FROM lessons WHERE id = ?', [id]);
  },
};

function rowToBoard(row: any): Board {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    page: Number(row.page),
    strokes: JSON.parse(row.strokes || '[]'),
    annotations: JSON.parse(row.annotations || '[]'),
    viewport: JSON.parse(row.viewport || '{"x":0,"y":0,"scale":1,"rotation":0}'),
    createdAt: new Date(Number(row.created_at)),
    updatedAt: new Date(Number(row.updated_at)),
  };
}

export const BoardRepository = {
  create(board: Board): void {
    runSql(`
      INSERT INTO boards (id, lesson_id, page, strokes, annotations, viewport, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      board.id,
      board.lessonId,
      board.page,
      JSON.stringify(board.strokes),
      JSON.stringify(board.annotations),
      JSON.stringify(board.viewport),
      board.createdAt.getTime(),
      board.updatedAt.getTime()
    ]);
  },

  getById(id: string): Board | null {
    const row = queryOne('SELECT * FROM boards WHERE id = ?', [id]);
    return row ? rowToBoard(row) : null;
  },

  getByLesson(lessonId: string): Board[] {
    const rows = queryAll('SELECT * FROM boards WHERE lesson_id = ? ORDER BY page', [lessonId]);
    return rows.map(rowToBoard);
  },

  update(board: Board): void {
    runSql(`
      UPDATE boards 
      SET strokes = ?, annotations = ?, viewport = ?, updated_at = ?
      WHERE id = ?
    `, [
      JSON.stringify(board.strokes),
      JSON.stringify(board.annotations),
      JSON.stringify(board.viewport),
      board.updatedAt.getTime(),
      board.id
    ]);
  },

  delete(id: string): void {
    runSql('DELETE FROM boards WHERE id = ?', [id]);
  },
};

function rowToSession(row: any): Session {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    lessonId: row.lesson_id || undefined,
    boardId: row.board_id || undefined,
    startedAt: new Date(Number(row.started_at)),
    endedAt: row.ended_at ? new Date(Number(row.ended_at)) : undefined,
    state: JSON.parse(row.state || '{}'),
    actions: JSON.parse(row.actions || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
  };
}

export const SessionRepository = {
  create(session: Session): void {
    runSql(`
      INSERT INTO sessions (id, teacher_id, lesson_id, board_id, started_at, ended_at, state, actions, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      session.id,
      session.teacherId,
      session.lessonId || null,
      session.boardId || null,
      session.startedAt.getTime(),
      session.endedAt?.getTime() || null,
      JSON.stringify(session.state),
      JSON.stringify(session.actions),
      JSON.stringify(session.metadata)
    ]);
  },

  getById(id: string): Session | null {
    const row = queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
    return row ? rowToSession(row) : null;
  },

  getActiveByTeacher(teacherId: string): Session | null {
    const row = queryOne('SELECT * FROM sessions WHERE teacher_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1', [teacherId]);
    return row ? rowToSession(row) : null;
  },

  getByTeacher(teacherId: string, limit = 50): Session[] {
    const rows = queryAll('SELECT * FROM sessions WHERE teacher_id = ? ORDER BY started_at DESC LIMIT ?', [teacherId, limit]);
    return rows.map(rowToSession);
  },

  update(session: Session): void {
    runSql(`
      UPDATE sessions 
      SET lesson_id = ?, board_id = ?, ended_at = ?, state = ?, actions = ?, metadata = ?
      WHERE id = ?
    `, [
      session.lessonId || null,
      session.boardId || null,
      session.endedAt?.getTime() || null,
      JSON.stringify(session.state),
      JSON.stringify(session.actions),
      JSON.stringify(session.metadata),
      session.id
    ]);
  },

  addAction(sessionId: string, action: SessionAction): void {
    const session = this.getById(sessionId);
    if (session) {
      session.actions.push(action);
      this.update(session);
    }
  },
};

export const SettingsRepository = {
  get<T>(key: string, defaultValue: T): T {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? JSON.parse(row.value) : defaultValue;
  },

  set<T>(key: string, value: T): void {
    const now = Date.now();
    runSql(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `, [key, JSON.stringify(value), now, JSON.stringify(value), now]);
  },

  getAll(): Record<string, any> {
    const rows = queryAll('SELECT key, value FROM settings');
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  },
};

function rowToBackup(row: any): BackupInfo {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    size: Number(row.size),
    createdAt: new Date(Number(row.created_at)),
    includes: JSON.parse(row.includes || '[]'),
  };
}

export const BackupRepository = {
  create(backup: BackupInfo): void {
    runSql(`
      INSERT INTO backups (id, name, path, size, created_at, includes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      backup.id,
      backup.name,
      backup.path,
      backup.size,
      backup.createdAt.getTime(),
      JSON.stringify(backup.includes)
    ]);
  },

  getAll(): BackupInfo[] {
    const rows = queryAll('SELECT * FROM backups ORDER BY created_at DESC');
    return rows.map(rowToBackup);
  },

  delete(id: string): void {
    runSql('DELETE FROM backups WHERE id = ?', [id]);
  },
};

export async function closeDatabase(): Promise<void> {
  if (db) {
    await persistDatabase();
    db.close();
    db = null;
  }
}