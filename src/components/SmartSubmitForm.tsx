'use client';

// FIX: Path diarahkan ke folder hooks yang baru
import { useSmartSubmit, type PermintaanHeader } from '../hooks/useSmartSubmit';

interface SmartSubmitFormProps {
  onUploadSuccess: (data: PermintaanHeader) => void;
}

export default function SmartSubmitForm({ onUploadSuccess }: SmartSubmitFormProps) {
  const {
    fileInputRef,
    file,
    isLoading,
    error,
    successMessage,
    handleFileChange,
    handleSubmit,
  } = useSmartSubmit(onUploadSuccess);

  return (
    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 mb-6">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Smart Submit (Upload FPP PDF)</h3>
      <form onSubmit={handleSubmit}>
        <label className="block mb-2 text-sm font-medium text-slate-600" htmlFor="file_input">Upload file FPP (Format PDF)</label>
        <input
          ref={fileInputRef}
          id="file_input"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-700 border border-slate-300 rounded-lg cursor-pointer bg-white focus:outline-none mb-4 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        <button type="submit" disabled={isLoading || !file} className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:bg-slate-400">
          {isLoading ? 'Memproses dengan AI...' : 'Upload & Submit'}
        </button>
        {successMessage && <p className="text-emerald-600 font-medium text-sm mt-3">{successMessage}</p>}
        {error && <p className="text-red-600 font-medium text-sm mt-3">{error}</p>}
      </form>
    </div>
  );
}