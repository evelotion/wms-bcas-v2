'use client';

import { useState, useRef } from 'react';

// Tipe data ini bisa diekspor dan digunakan di mana saja
export interface PermintaanHeader {
  id: string;
  nomor_fpp: string;
  cabang: string;
  details: { id: string }[];
}

interface UploadResponse {
  message: string;
  data?: PermintaanHeader;
  detail?: string; // Error dari FastAPI
}

export function useSmartSubmit(onUploadSuccess: (data: PermintaanHeader) => void) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentFile = e.target.files?.[0];
    setFile(currentFile || null);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Pilih file PDF terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/extract-fpp/', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Terjadi kesalahan saat memproses file.');
      }

      setSuccessMessage(result.message || 'Upload berhasil!');
      if (result.data) {
        onUploadSuccess(result.data);
      }
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Tidak dapat terhubung ke server. Pastikan service berjalan.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fileInputRef, file, isLoading, error, successMessage, handleFileChange, handleSubmit,
  };
}