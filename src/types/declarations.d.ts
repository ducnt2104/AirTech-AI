declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[] | Record<string, any>): Database;
    exec(sql: string, params?: any[] | Record<string, any>): QueryExecResult[];
    prepare(sql: string, params?: any[] | Record<string, any>): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface Statement {
    bind(values?: any[] | Record<string, any>): boolean;
    step(): boolean;
    get(params?: any[] | Record<string, any>): any[];
    getColumnNames(): string[];
    getAsObject(params?: any[] | Record<string, any>): Record<string, any>;
    run(values?: any[] | Record<string, any>): void;
    reset(): void;
    free(): boolean;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayBuffer | Uint8Array | number[]) => Database;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  namespace initSqlJs {
    export type Database = import('sql.js').Database;
  }
  export default initSqlJs;
}
