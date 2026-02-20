import React, { useState } from 'react';
import { X, Cloud, AlertCircle, Check, Terminal, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { FirebaseConfig, testFirebaseConnection } from '../services/storageService';

interface CloudSetupModalProps {
  onClose: () => void;
  onSave: (config: FirebaseConfig) => void;
}

export const CloudSetupModal: React.FC<CloudSetupModalProps> = ({ onClose, onSave }) => {
  const [configJson, setConfigJson] = useState('');
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = async () => {
    try {
      setError('');
      let config: FirebaseConfig;
      
      try {
        // Method 1: Flexible JS Object parsing (safe-ish for config setup)
        // This handles unquoted keys, single quotes, trailing commas, comments etc.
        // It treats the input as a JavaScript object literal.
        const parseFn = new Function(`return ${configJson.trim()}`);
        config = parseFn();
      } catch (e) {
        // Method 2: Fallback to Strict JSON parse if the above fails
        try {
           config = JSON.parse(configJson);
        } catch (jsonError) {
           throw new Error("설정 형식을 인식할 수 없습니다. (Javascript Object 또는 JSON 형식이 아닙니다)");
        }
      }

      if (!config || typeof config !== 'object') {
         throw new Error("유효한 설정 객체가 아닙니다.");
      }

      // Validation
      const missingFields = [];
      if (!config.apiKey) missingFields.push('apiKey');
      if (!config.projectId) missingFields.push('projectId');
      
      if (missingFields.length > 0) {
        throw new Error(`필수 값이 누락되었습니다: ${missingFields.join(', ')}`);
      }

      // Check for databaseURL specifically for RTDB
      if (!config.databaseURL) {
        // Try to suggest a fix or force the user to add it
        const inferredUrl = `https://${config.projectId}-default-rtdb.firebaseio.com`;
        
        // Use window.confirm to ask user
        if (window.confirm(`설정에 'databaseURL'이 없습니다. (Realtime Database 필수)\n\n자동으로 다음 주소를 추가할까요?\n${inferredUrl}`)) {
          config.databaseURL = inferredUrl;
        } else {
          setError("'databaseURL'이 없습니다. Firebase Console의 Realtime Database 섹션에서 URL을 확인하고 추가해주세요.");
          return;
        }
      }

      // Test Connection
      setIsTesting(true);
      try {
        await testFirebaseConnection(config);
      } catch (connError: any) {
        throw new Error(`연결 실패: ${connError.message}`);
      } finally {
        setIsTesting(false);
      }

      onSave(config);
      onClose();
    } catch (e: any) {
      setIsTesting(false);
      setError(e.message || "설정을 파싱하는 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
               <Cloud size={24} />
            </div>
            클라우드(Firebase) 연결
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-600 mb-6 space-y-2">
           <p className="font-semibold text-indigo-600 flex items-center gap-2">
             <Terminal size={16} />
             설정 붙여넣기
           </p>
           <p>Firebase Console에서 복사한 내용을 그대로 붙여넣으세요.</p>
           <p className="text-xs text-slate-500">
             (따옴표가 없거나, 자바스크립트 객체 형식이어도 자동으로 인식됩니다)
           </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Firebase Config</label>
          <textarea
            value={configJson}
            onChange={(e) => {
              setConfigJson(e.target.value);
              setError('');
            }}
            placeholder={
`const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "...",
  projectId: "...",
  databaseURL: "https://...",
  ...
};`}
            className="w-full h-48 p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-600"
            disabled={isTesting}
          />
          {error && (
            <div className="flex items-start gap-2 text-red-500 text-xs mt-2 bg-red-50 p-2 rounded-lg">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isTesting}>취소</Button>
          <Button onClick={handleSave} disabled={!configJson.trim() || isTesting}>
            {isTesting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                연결 테스트 중...
              </>
            ) : (
              '연결하고 저장하기'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};