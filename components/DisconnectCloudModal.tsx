import React from 'react';
import { CloudOff, X, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface DisconnectCloudModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export const DisconnectCloudModal: React.FC<DisconnectCloudModalProps> = ({ onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-200 border border-slate-100 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-amber-100 p-4 rounded-full text-amber-600">
            <CloudOff size={32} />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-2">클라우드 연결 해제</h2>
        
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2 text-left mb-6">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            연결을 해제하면 브라우저에 저장된 <strong>Firebase 설정 정보가 삭제</strong>되며, 다시 로컬 모드로 전환됩니다. 클라우드에 저장된 데이터는 삭제되지 않지만, 다시 연결하기 전까지는 접근할 수 없습니다.
          </p>
        </div>

        <p className="text-slate-600 text-sm mb-8">
          정말로 클라우드 연결을 해제하시겠습니까?
        </p>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button variant="danger" onClick={onConfirm} className="flex-1 shadow-red-200">
            연결 해제
          </Button>
        </div>
      </div>
    </div>
  );
};
