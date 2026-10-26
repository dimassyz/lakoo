import React from "react";

const DetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Detail Barang</h1>
        </div>

        <div className="rounded-[8px] border border-[#6B7280] bg-white p-6">
          <div className="text-center">
            <div className="mb-1 text-5xl font-bold text-[#1F1F1F]">
              Keripik Balado
            </div>
            <div className="text-4xl font-bold text-[#10B981]">Rp 45.000</div>
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

          <button className="mt-8 w-full rounded-[8px] bg-[#10B981] py-4 text-lg font-semibold text-white active:scale-[0.95]">
            Lihat Rekomendasi Rencana
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailPage;
