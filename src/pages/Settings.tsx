import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Eye, Hand, PenTool, Brain, Globe,
  HardDrive, Shield, Cpu, Palette, Keyboard, Bell,
  Save, RefreshCw, Download, Upload, Trash2, AlertCircle,
  CheckCircle, Info, ChevronDown, ChevronRight, Settings
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeacherStore } from '@/stores/teacherStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

const sections = [
  { id: 'general', label: 'Chung', icon: 'Settings' },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'face', label: 'Nhận diện khuôn mặt', icon: Eye },
  { id: 'gesture', label: 'Cử chỉ tay', icon: Hand },
  { id: 'drawing', label: 'Vẽ & Công cụ', icon: PenTool },
  { id: 'ai', label: 'AI & Mô hình', icon: Brain },
  { id: 'browser', label: 'Trình duyệt', icon: Globe },
  { id: 'storage', label: 'Lưu trữ', icon: HardDrive },
  { id: 'privacy', label: 'Riêng tư', icon: Shield },
  { id: 'performance', label: 'Hiệu năng', icon: Cpu },
  { id: 'appearance', label: 'Giao diện', icon: Palette },
  { id: 'shortcuts', label: 'Phím tắt', icon: Keyboard },
] as const;

type SectionId = typeof sections[number]['id'];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSection, exportSettings, importSettings, loadSettings, resetToDefaults } = useSettingsStore();
  const { teachers } = useTeacherStore();
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [showExport, setShowExport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleExport = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airtech-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('success', 'Đã xuất cài đặt');
  };

  const handleImport = () => {
    if (!importJson.trim()) return;
    const success = importSettings(importJson);
    if (success) {
      showMessage('success', 'Đã nhập cài đặt');
      setImportJson('');
      setShowExport(false);
    } else {
      showMessage('error', 'File cài đặt không hợp lệ');
    }
  };

  const handleReset = () => {
    if (confirm('Khôi phục cài đặt mặc định? Hành động này không thể hoàn tác.')) {
      resetToDefaults();
      showMessage('success', 'Đã khôi phục cài đặt mặc định');
    }
  };

  const getSectionIcon = (id: SectionId) => {
    const icons: Record<string, any> = {
      general: 'Settings',
      camera: Camera,
      face: Eye,
      gesture: Hand,
      drawing: PenTool,
      ai: Brain,
      browser: Globe,
      storage: HardDrive,
      privacy: Shield,
      performance: Cpu,
      appearance: Palette,
      shortcuts: Keyboard,
    };
    return icons[id] || Settings;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-56 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </span>
            Cài đặt
          </h1>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto" role="navigation" aria-label="Settings sections">
          <ul className="space-y-1" role="list">
            {sections.map((section) => {
              const Icon = getSectionIcon(section.id);
              return (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      activeSection === section.id
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    role="tab"
                    aria-selected={activeSection === section.id}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Xuất cài đặt
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowExport(true)}>
            <Upload className="w-4 h-4" />
            Nhập cài đặt
          </Button>
          <Button variant="ghost" size="sm" className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={handleReset}>
            <RefreshCw className="w-4 h-4" />
            Khôi phục mặc định
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        {message && (
          <div className={cn(
            'mb-6 p-4 rounded-lg flex items-center gap-3 animate-slide-up',
            message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          )} role="alert">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
              {sections.find(s => s.id === activeSection)?.label}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {getSectionDescription(activeSection)}
            </p>
          </div>

          <Card className="p-6" variant="outlined">
            {renderSection(activeSection, settings, updateSection, showMessage)}
          </Card>
        </div>

        {showExport && (
          <Modal onClose={() => { setShowExport(false); setImportJson(''); }}>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Nhập cài đặt từ file JSON</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Dán nội dung file JSON cài đặt vào ô dưới đây:
              </p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={10}
                className="w-full input font-mono text-sm"
                placeholder='{"general": {...}, "camera": {...}, ...}'
              />
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setShowExport(false); setImportJson(''); }}>
                  Hủy
                </Button>
                <Button variant="primary" onClick={handleImport}>
                  Nhập cài đặt
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}

function renderSection(section: SectionId, settings: any, updateSection: any, showMessage: any) {
  switch (section) {
    case 'general':
      return (
        <div className="space-y-6">
          <SettingGroup title="Ngôn ngữ & Khu vực">
            <SelectSetting
              label="Ngôn ngữ"
              value={settings.general.language}
              options={[{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }]}
              onChange={(v) => updateSection('general', { language: v })}
            />
          </SettingGroup>
          <SettingGroup title="Khởi động">
            <ToggleSetting
              label="Tự động bật camera khi mở ứng dụng"
              value={settings.general.autoStartCamera}
              onChange={(v) => updateSection('general', { autoStartCamera: v })}
            />
            <ToggleSetting
              label="Tự động tải phiên học cuối cùng"
              value={settings.general.autoLoadLastSession}
              onChange={(v) => updateSection('general', { autoLoadLastSession: v })}
            />
            <ToggleSetting
              label="Xác nhận trước khi thoát"
              value={settings.general.confirmBeforeExit}
              onChange={(v) => updateSection('general', { confirmBeforeExit: v })}
            />
            <ToggleSetting
              label="Kiểm tra cập nhật tự động"
              value={settings.general.checkUpdates}
              onChange={(v) => updateSection('general', { checkUpdates: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'camera':
      return (
        <div className="space-y-6">
          <SettingGroup title="Thiết bị Camera">
            <SelectSetting
              label="Camera"
              value={settings.camera.deviceId || 'default'}
              options={[
                { value: 'default', label: 'Camera mặc định' },
                { value: 'front', label: 'Camera trước' },
                { value: 'back', label: 'Camera sau' },
              ]}
              onChange={(v) => updateSection('camera', { deviceId: v })}
            />
          </SettingGroup>
          <SettingGroup title="Độ phân giải & FPS">
            <SelectSetting
              label="Độ phân giải"
              value={`${settings.camera.width}x${settings.camera.height}`}
              options={[
                { value: '640x480', label: '640x480 (VGA)' },
                { value: '1280x720', label: '1280x720 (HD)' },
                { value: '1920x1080', label: '1920x1080 (Full HD)' },
              ]}
              onChange={(v) => {
                const [w, h] = v.split('x').map(Number);
                updateSection('camera', { width: w, height: h });
              }}
            />
            <NumberSetting
              label="FPS mục tiêu"
              value={settings.camera.frameRate}
              min={15}
              max={60}
              step={5}
              onChange={(v) => updateSection('camera', { frameRate: v })}
            />
          </SettingGroup>
          <SettingGroup title="Hành vi">
            <SelectSetting
              label="Chế độ camera"
              value={settings.camera.facingMode}
              options={[
                { value: 'user', label: 'Camera trước (Selfie)' },
                { value: 'environment', label: 'Camera sau (Môi trường)' },
              ]}
              onChange={(v) => updateSection('camera', { facingMode: v as any })}
            />
            <ToggleSetting
              label="Lật hình ảnh (Gương)"
              value={settings.camera.mirror}
              onChange={(v) => updateSection('camera', { mirror: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'face':
      return (
        <div className="space-y-6">
          <SettingGroup title="Cài đặt nhận diện">
            <ToggleSetting
              label="Bật nhận diện khuôn mặt"
              value={settings.face.enabled}
              onChange={(v) => updateSection('face', { enabled: v })}
            />
            <SelectSetting
              label="Mô hình"
              value={settings.face.model}
              options={[
                { value: 'tiny', label: 'Tiny (Nhanh, ít chính xác)' },
                { value: 'short', label: 'Short (Cân bằng)' },
                { value: 'full', label: 'Full (Chính xác, chậm)' },
              ]}
              onChange={(v) => updateSection('face', { model: v as any })}
            />
            <NumberSetting
              label="Ngưỡng tin cậy"
              value={settings.face.threshold}
              min={0.3}
              max={0.9}
              step={0.05}
              onChange={(v) => updateSection('face', { threshold: v })}
            />
            <NumberSetting
              label="Số khuôn mặt tối đa"
              value={settings.face.maxFaces}
              min={1}
              max={5}
              step={1}
              onChange={(v) => updateSection('face', { maxFaces: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'gesture':
      return (
        <div className="space-y-6">
          <SettingGroup title="Cài đặt cử chỉ">
            <ToggleSetting
              label="Bật nhận diện cử chỉ"
              value={settings.gesture.enabled}
              onChange={(v) => updateSection('gesture', { enabled: v })}
            />
            <NumberSetting
              label="Độ nhạy"
              value={settings.gesture.sensitivity}
              min={0.1}
              max={1}
              step={0.1}
              onChange={(v) => updateSection('gesture', { sensitivity: v })}
            />
            <NumberSetting
              label="Thời gian chờ giữa các cử chỉ (ms)"
              value={settings.gesture.cooldown}
              min={100}
              max={2000}
              step={100}
              onChange={(v) => updateSection('gesture', { cooldown: v })}
            />
            <NumberSetting
              label="Debounce frames"
              value={settings.gesture.debounceMs}
              min={100}
              max={1000}
              step={50}
              onChange={(v) => updateSection('gesture', { debounceMs: v })}
            />
          </SettingGroup>
          <SettingGroup title="Ánh xạ cử chỉ">
            <GestureMappingEditor mappings={settings.gesture.customMappings} onChange={(m) => updateSection('gesture', { customMappings: m })} />
          </SettingGroup>
        </div>
      );

    case 'drawing':
      return (
        <div className="space-y-6">
          <SettingGroup title="Cài đặt vẽ">
            <NumberSetting
              label="Độ mượt (Smoothing)"
              value={settings.drawing.smoothing}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateSection('drawing', { smoothing: v })}
            />
            <ToggleSetting
              label="Nội suy điểm (Interpolation)"
              value={settings.drawing.interpolation}
              onChange={(v) => updateSection('drawing', { interpolation: v })}
            />
            <ToggleSetting
              label="Độ nhạy áp lực bút"
              value={settings.drawing.pressureSensitivity}
              onChange={(v) => updateSection('drawing', { pressureSensitivity: v })}
            />
            <ToggleSetting
              label="Nhận dạng hình tự động"
              value={settings.drawing.autoShapeRecognition}
              onChange={(v) => updateSection('drawing', { autoShapeRecognition: v })}
            />
            <NumberSetting
              label="Ngưỡng nhận dạng hình"
              value={settings.drawing.shapeThreshold}
              min={0.5}
              max={1}
              step={0.05}
              onChange={(v) => updateSection('drawing', { shapeThreshold: v })}
            />
          </SettingGroup>
          <SettingGroup title="Mặc định">
            <ColorSetting
              label="Màu mặc định"
              value={settings.drawing.defaultColor}
              onChange={(v) => updateSection('drawing', { defaultColor: v })}
            />
            <NumberSetting
              label="Độ dày nét mặc định"
              value={settings.drawing.defaultWidth}
              min={1}
              max={50}
              step={1}
              onChange={(v) => updateSection('drawing', { defaultWidth: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'ai':
      return (
        <div className="space-y-6">
          <SettingGroup title="Nhà cung cấp AI">
            <SelectSetting
              label="Chế độ AI"
              value={settings.ai.provider}
              options={[
                { value: 'local', label: 'Chỉ Local (Offline)' },
                { value: 'online', label: 'Online API' },
                { value: 'hybrid', label: 'Kết hợp (Ưu tiên Local)' },
              ]}
              onChange={(v) => updateSection('ai', { provider: v as any })}
            />
            {settings.ai.provider !== 'local' && (
              <>
                <Input
                  label="API Endpoint (tùy chọn)"
                  value={settings.ai.onlineEndpoint || ''}
                  onChange={(e) => updateSection('ai', { onlineEndpoint: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
                <Input
                  label="API Key"
                  type="password"
                  value={settings.ai.onlineApiKey || ''}
                  onChange={(e) => updateSection('ai', { onlineApiKey: e.target.value })}
                  placeholder="Nhập API key của bạn"
                />
              </>
            )}
          </SettingGroup>
          <SettingGroup title="Tính năng AI">
            <ToggleSetting
              label="Nhận dạng hình học"
              value={settings.ai.enableShapeRecognition}
              onChange={(v) => updateSection('ai', { enableShapeRecognition: v })}
            />
            <ToggleSetting
              label="OCR (Nhận dạng văn bản)"
              value={settings.ai.enableOCR}
              onChange={(v) => updateSection('ai', { enableOCR: v })}
            />
            <ToggleSetting
              label="Nhận dạng chữ viết tay"
              value={settings.ai.enableHandwritingRecognition}
              onChange={(v) => updateSection('ai', { enableHandwritingRecognition: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'browser':
      return (
        <div className="space-y-6">
          <SettingGroup title="Trang chủ & Tìm kiếm">
            <Input
              label="Trang chủ"
              value={settings.browser.homepage}
              onChange={(e) => updateSection('browser', { homepage: e.target.value })}
              placeholder="https://www.google.com"
            />
            <ToggleSetting
              label="Bật JavaScript"
              value={settings.browser.enableJavaScript}
              onChange={(v) => updateSection('browser', { enableJavaScript: v })}
            />
            <ToggleSetting
              label="Cho phép Plugin"
              value={settings.browser.enablePlugins}
              onChange={(v) => updateSection('browser', { enablePlugins: v })}
            />
          </SettingGroup>
          <SettingGroup title="Bộ lọc tên miền">
            <Input
              label="Tên miền cho phép (phân cách bằng dấu phẩy)"
              value={settings.browser.allowedDomains.join(', ')}
              onChange={(e) => updateSection('browser', { allowedDomains: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="google.com, youtube.com"
            />
            <Input
              label="Tên miền chặn (phân cách bằng dấu phẩy)"
              value={settings.browser.blockedDomains.join(', ')}
              onChange={(e) => updateSection('browser', { blockedDomains: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="ads.example.com"
            />
          </SettingGroup>
        </div>
      );

    case 'storage':
      return (
        <div className="space-y-6">
          <SettingGroup title="Lưu trữ">
            <NumberSetting
              label="Dung lượng tối đa (GB)"
              value={settings.storage.maxStorageGB}
              min={1}
              max={50}
              step={1}
              onChange={(v) => updateSection('storage', { maxStorageGB: v })}
            />
            <ToggleSetting
              label="Sao lưu tự động"
              value={settings.storage.autoBackup}
              onChange={(v) => updateSection('storage', { autoBackup: v })}
            />
            <NumberSetting
              label="Khoảng thời gian sao lưu (giờ)"
              value={settings.storage.backupIntervalHours}
              min={1}
              max={168}
              step={1}
              onChange={(v) => updateSection('storage', { backupIntervalHours: v })}
            />
            <ToggleSetting
              label="Nén file sao lưu"
              value={settings.storage.compressBackups}
              onChange={(v) => updateSection('storage', { compressBackups: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'privacy':
      return (
        <div className="space-y-6">
          <SettingGroup title="Bảo mật dữ liệu">
            <ToggleSetting
              label="Chỉ xử lý local (Không gửi dữ liệu ra ngoài)"
              value={settings.privacy.localProcessingOnly}
              onChange={(v) => updateSection('privacy', { localProcessingOnly: v })}
            />
            <ToggleSetting
              label="Không thu thập telemetry"
              value={settings.privacy.noTelemetry}
              onChange={(v) => updateSection('privacy', { noTelemetry: v })}
            />
            <ToggleSetting
              label="Xóa dữ liệu khuôn mặt khi hủy đăng ký"
              value={settings.privacy.deleteFaceDataOnUnregister}
              onChange={(v) => updateSection('privacy', { deleteFaceDataOnUnregister: v })}
            />
            <ToggleSetting
              label="Hiển thị chỉ báo camera"
              value={settings.privacy.cameraIndicator}
              onChange={(v) => updateSection('privacy', { cameraIndicator: v })}
            />
            <ToggleSetting
              label="Yêu cầu xác nhận trước khi dùng AI Online"
              value={settings.privacy.requirePermissionForOnlineAI}
              onChange={(v) => updateSection('privacy', { requirePermissionForOnlineAI: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'performance':
      return (
        <div className="space-y-6">
          <SettingGroup title="Chế độ hiệu năng">
            <SelectSetting
              label="Chế độ"
              value={settings.performance.mode}
              options={[
                { value: 'battery', label: 'Tiết kiệm pin (Model nhẹ, FPS thấp)' },
                { value: 'balanced', label: 'Cân bằng' },
                { value: 'high', label: 'Hiệu năng cao (Model đầy đủ, FPS cao)' },
              ]}
              onChange={(v) => updateSection('performance', { mode: v as any })}
            />
            <NumberSetting
              label="FPS tối đa"
              value={settings.performance.maxFPS}
              min={15}
              max={60}
              step={5}
              onChange={(v) => updateSection('performance', { maxFPS: v })}
            />
            <NumberSetting
              label="Số luồng suy luận"
              value={settings.performance.inferenceThreads}
              min={1}
              max={8}
              step={1}
              onChange={(v) => updateSection('performance', { inferenceThreads: v })}
            />
            <ToggleSetting
              label="Sử dụng GPU"
              value={settings.performance.useGPU}
              onChange={(v) => updateSection('performance', { useGPU: v })}
            />
            <SelectSetting
              label="Độ chính xác mô hình"
              value={settings.performance.modelPrecision}
              options={[
                { value: 'fp32', label: 'FP32 (Chính xác cao)' },
                { value: 'fp16', label: 'FP16 (Cân bằng)' },
                { value: 'int8', label: 'INT8 (Nhanh, nhẹ)' },
              ]}
              onChange={(v) => updateSection('performance', { modelPrecision: v as any })}
            />
          </SettingGroup>
        </div>
      );

    case 'appearance':
      return (
        <div className="space-y-6">
          <SettingGroup title="Giao diện">
            <SelectSetting
              label="Chủ đề"
              value={settings.appearance.theme}
              options={[
                { value: 'light', label: 'Sáng' },
                { value: 'dark', label: 'Tối' },
                { value: 'system', label: 'Theo hệ thống' },
              ]}
              onChange={(v) => updateSection('appearance', { theme: v as any })}
            />
            <ColorSetting
              label="Màu chủ đạo"
              value={settings.appearance.primaryColor}
              onChange={(v) => updateSection('appearance', { primaryColor: v })}
            />
            <SelectSetting
              label="Kích thước chữ"
              value={settings.appearance.fontSize}
              options={[
                { value: 'small', label: 'Nhỏ' },
                { value: 'medium', label: 'Vừa' },
                { value: 'large', label: 'Lớn' },
              ]}
              onChange={(v) => updateSection('appearance', { fontSize: v as any })}
            />
            <SelectSetting
              label="Vị trí thanh công cụ"
              value={settings.appearance.toolbarPosition}
              options={[
                { value: 'top', label: 'Trên' },
                { value: 'bottom', label: 'Dưới' },
                { value: 'left', label: 'Trái' },
                { value: 'right', label: 'Phải' },
                { value: 'floating', label: 'Nổi (Mặc định)' },
              ]}
              onChange={(v) => updateSection('appearance', { toolbarPosition: v as any })}
            />
          </SettingGroup>
          <SettingGroup title="Khả năng tiếp cận">
            <ToggleSetting
              label="Giảm chuyển động"
              value={settings.appearance.reducedMotion}
              onChange={(v) => updateSection('appearance', { reducedMotion: v })}
            />
            <ToggleSetting
              label="Độ tương phản cao"
              value={settings.appearance.highContrast}
              onChange={(v) => updateSection('appearance', { highContrast: v })}
            />
          </SettingGroup>
        </div>
      );

    case 'shortcuts':
      return (
        <div className="space-y-6">
          <SettingGroup title="Phím tắt">
            <ShortcutsEditor shortcuts={settings.shortcuts.shortcuts} onChange={(s) => updateSection('shortcuts', { shortcuts: s })} />
          </SettingGroup>
        </div>
      );

    default:
      return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chọn mục cài đặt từ thanh bên</div>;
  }
}

function getSectionDescription(section: SectionId): string {
  const descriptions: Record<SectionId, string> = {
    general: 'Cài đặt chung của ứng dụng',
    camera: 'Cấu hình camera và độ phân giải video',
    face: 'Cài đặt nhận diện khuôn mặt giáo viên',
    gesture: 'Cấu hình nhận diện cử chỉ tay',
    drawing: 'Cài đặt công cụ vẽ và nét vẽ',
    ai: 'Cấu hình mô hình AI và API',
    browser: 'Cài đặt trình duyệt web tích hợp',
    storage: 'Quản lý lưu trữ và sao lưu',
    privacy: 'Cài đặt bảo mật và riêng tư',
    performance: 'Tối ưu hiệu năng cho thiết bị',
    appearance: 'Tùy chỉnh giao diện người dùng',
    shortcuts: 'Cấu hình phím tắt bàn phím',
  };
  return descriptions[section];
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          value ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </button>
    </label>
  );
}

function SelectSetting({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function NumberSetting({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        {label}
        <span className="text-xs text-gray-500 dark:text-gray-400">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none accent-primary-600 cursor-pointer"
      />
    </div>
  );
}

function ColorSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-12 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
      />
    </div>
  );
}

function GestureMappingEditor({ mappings, onChange }: { mappings: Record<string, string>; onChange: (m: Record<string, string>) => void }) {
  const gestures = ['DRAW', 'POINTER', 'ERASE', 'SELECT', 'UNDO', 'REDO', 'NEXT_PAGE', 'PREVIOUS_PAGE', 'OPEN_MENU', 'CONFIRM', 'CANCEL', 'TOOL_SWITCH', 'ZOOM_IN', 'ZOOM_OUT', 'PAN'] as const;
  
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {gestures.map(g => (
        <div key={g} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="font-mono text-sm text-gray-600 dark:text-gray-400 w-28">{g}</span>
          <span className="text-gray-400">→</span>
          <input
            type="text"
            value={mappings[g] || ''}
            onChange={(e) => onChange({ ...mappings, [g]: e.target.value })}
            placeholder="Tùy chỉnh..."
            className="input flex-1 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

function ShortcutsEditor({ shortcuts, onChange }: { shortcuts: Record<string, string>; onChange: (s: Record<string, string>) => void }) {
  const defaultShortcuts = {
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    clear: 'Ctrl+Shift+X',
    nextSlide: 'ArrowRight',
    prevSlide: 'ArrowLeft',
    presentationMode: 'F5',
    exitPresentation: 'Escape',
    toggleToolbar: 'T',
    toggleFullscreen: 'F11',
    openSettings: 'Ctrl+,',
    newBoard: 'Ctrl+N',
    saveBoard: 'Ctrl+S',
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(defaultShortcuts).map(([key, defaultValue]) => (
        <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="font-mono text-sm text-gray-600 dark:text-gray-400 w-28 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
          <span className="text-gray-400">→</span>
          <input
            type="text"
            value={shortcuts[key] || defaultValue}
            onChange={(e) => onChange({ ...shortcuts, [key]: e.target.value })}
            className="input flex-1 text-sm font-mono"
            placeholder={defaultValue}
          />
        </div>
      ))}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <Card className="relative w-full max-w-2xl p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </Card>
    </div>
  );
}