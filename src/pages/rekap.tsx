import React from 'react';

const RekapPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1F1F1F]">Rekap Penjualan</h1>
        </div>

        <div className="bg-white border border-[#6B7280] rounded-[8px] p-6">
          <div className="text-center">
            <p className="text-[#6B7280] text-sm mb-2">Mode Opname</p>
            <div className="flex items-center justify-center gap-3">
              <button className="px-6 py-3 bg-[#10B981] text-white font-semibold text-lg rounded-[8px] active:scale-[0.95]">
                Masuk
              </button>
              <button className="px-6 py-3 border border-[#6B7280] text-[#1F1F1F] font-semibold text-lg rounded-[8px] active:scale-[0.95]">
                Keluar
              </button>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label className="block text-sm text-[#6B7280] mb-1">Qty</label>
              <input
                type="number"
                className="w-full border border-[#6B7280] rounded-[8px] px-4 py-3 text-2xl font-bold focus:outline-none focus:border-[#10B981]"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm text-[#6B7280] mb-1">Harga</label>
              <input
                type="number"
                className="w-full border border-[#6B7280] rounded-[8px] px-4 py-3 text-2xl font-bold focus:outline-none focus:border-[#10B981]"
                placeholder="0"
              />
            </div>

            <button className="w-full py-4 bg-[#10B981] text-white font-semibold text-lg rounded-[8px] active:scale-[0.95] mt-6">
              Simpan Rekap
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[#6B7280]">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Total Kas Masuk</span>
              <span className="font-medium">Rp 0</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-[#6B7280]">Total Kas Keluar</span>
              <span className="font-medium">Rp 0</span>
            </div>
            <div className="flex justify-between text-sm mt-4 pt-4 border-t border-[#6B7280]">
              <span className="font-bold">Selisih</span>
              <span className="font-bold text-[#10B981]">Rp 0</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-[#6B7280] text-center">
          Data akan tersimpan di localStorage untuk demo
        </div>
      </div>
    </div>
  );
};

export default RekapPage;
