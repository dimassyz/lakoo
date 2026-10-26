import React from "react";

const BarangMasukPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Barang Masuk</h1>
        </div>

        <div className="rounded-[8px] border border-[#6B7280] bg-white p-6">
          <textarea
            placeholder="Tempel nota di sini..."
            className="h-40 w-full rounded-[8px] border border-[#6B7280] px-4 py-4 text-lg focus:border-[#10B981] focus:outline-none"
          />

          <button className="mt-6 w-full rounded-[8px] bg-[#10B981] py-4 text-lg font-semibold text-white active:scale-[0.95]">
            Parse & Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarangMasukPage;
