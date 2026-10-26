import React from 'react';

const DetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Detail Barang</h1>
        </div>

        <div className="bg-white border border-[#6B7280] rounded-[8px] p-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-[#1F1F1F] mb-1">Keripik Balado</div>
            <div className="text-[#10B981] text-4xl font-bold">Rp 45.000</div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-[#6B7280]">Stok Saat Ini</div>
              <div className="text-3xl font-bold">42</div>
            </div>
            <div>
              <div className="text-sm text-[#6B7280]">Status</div>
              <div className="text-3xl font-bold text-[#10B981]">Sehat</div>
            </div>
          </div>

          <button className="w-full py-4 bg-[#10B981] text-white font-semibold text-lg rounded-[8px] mt-8 active:scale-[0.95]">
            Lihat Rekomendasi Rencana
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailPage;
