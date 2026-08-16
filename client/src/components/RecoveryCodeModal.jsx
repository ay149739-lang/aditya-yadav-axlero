import { useState } from 'react';
import { ShieldAlert, Download, Copy, Check, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function RecoveryCodeModal({ isOpen, recoveryCode, onContinue }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !recoveryCode) return null;

  const handleDownload = () => {
    const fileContent = `SyncSpace Recovery Code\n\nRecovery Code:\n${recoveryCode}\n\nPurpose:\nUse this recovery code to reset your password if you ever forget it.\n\nImportant:\n• Keep this code safe.\n• Do not share it.\n• This code will not be shown again.\n• Without this code you cannot reset your password.\n`;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SyncSpace-Recovery-Code.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Recovery code downloaded successfully.');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryCode);
    setCopied(true);
    toast.success('Recovery Code copied successfully.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-[#12121e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30">
              <CheckCircle2 className="text-emerald-400 w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-white">Account Created Successfully</h3>
              <p className="text-xs text-gray-400">Save your recovery code to proceed</p>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-5 text-xs text-gray-300 space-y-2">
            <p className="font-medium text-gray-200">This Recovery Code is used to reset your password if you ever forget it.</p>
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <ShieldAlert size={14} className="shrink-0" />
              <span>This code will NOT be shown again.</span>
            </div>
            <p className="text-gray-400">Please save it in a secure location.</p>
          </div>

          {/* Recovery Code Box */}
          <div className="bg-black/60 border border-indigo-500/30 rounded-xl p-4 text-center mb-6 shadow-inner">
            <span className="text-xs text-gray-500 font-mono block mb-1 uppercase tracking-wider">Recovery Code</span>
            <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-indigo-400 select-all py-1">
              {recoveryCode}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={15} />
              <span>Download Recovery Code</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white text-xs font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copied ? 'Copied successfully' : 'Copy Recovery Code'}</span>
            </button>
          </div>

          {/* Continue Button */}
          <button
            type="button"
            onClick={onContinue}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/50"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
