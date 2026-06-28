'use client';

// Impor hook dan tipe data yang dibutuhkan
import { useSmartSubmit, type PermintaanHeader } from './useSmartSubmit'; // Sesuaikan path jika perlu

interface SmartSubmitFormProps {
  onUploadSuccess: (data: PermintaanHeader) => void; // Callback untuk refresh data di parent
}

export default function SmartSubmitForm({ onUploadSuccess }: SmartSubmitFormProps) {
  // Semua state dan logic sekarang datang dari satu hook. Bersih!
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
    <div className="p-4 border rounded-lg bg-gray-50 mb-6">
      <h3 className="text-lg font-semibold mb-2">Smart Submit (Upload FPP)</h3>
      <form onSubmit={handleSubmit}>
        <label className="block mb-2 text-sm font-medium text-gray-900" htmlFor="file_input">Upload file</label>
        <input
          ref={fileInputRef}
          id="file_input"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none mb-4"
        />

        <button type="submit" disabled={isLoading || !file} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">
          {isLoading ? 'Memproses...' : 'Upload & Submit'}
        </button>
        {successMessage && <p className="text-green-600 mt-2">{successMessage}</p>}
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </form>
    </div>
  );
}