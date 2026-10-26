import React from 'react';

const Stepper: React.FC = () => {
  const [qty, setQty] = React.useState(0);
  const [mode, setMode] = React.useState<'masuk' | 'keluar'>('masuk');

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQty(Number(e.target.value) || 0);
  };

  return (
    <div className="bg-white border border-[#6B7280] rounded-[8px] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1F1F1F]">Stepper Rekap</h2>
        <div className="flex border border-[#6B7280] rounded-[8px] overflow-hidden">
          <button
            onClick={() => setMode('masuk')}
            className={`px-6 py-2 text-sm font-medium ${mode === 'masuk' ? 'bg-[#10B981] text-white' : 'bg-white text-[#1F1F1F]'}`}
          >
            Masuk
          </button>
          <button
            onClick={() => setMode('keluar')}
            className={`px-6 py-2 text-sm font-medium ${mode === 'keluar' ? 'bg-[#10B981] text-white' : 'bg-white text-[#1F1F1F]'}`}
          >
            Keluar
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-sm text-[#6B7280] mb-2">Qty</div>
          <input
            type="number"
            value={qty}
            onChange={handleQtyChange}
            className="w-full border border-[#6B7280] rounded-[8px] px-4 py-3 text-3xl font-bold focus:outline-none focus:border-[#10B981]"
            placeholder="0"
          />
        </div>

        <button
          onClick={() => alert(`Rekap ${mode === 'masuk' ? 'masuk' : 'keluar'} Rp ${qty * 1000}`)}
          className="w-full py-4 bg-[#10B981] text-white font-semibold text-lg rounded-[8px] active:scale-[0.95]"
        >
          Hitung
        </button>
      </div>
    </div>
  );
};

export default Stepper;
