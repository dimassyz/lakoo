import React from 'react';

const NotaParser: React.FC = () => {
  return (
    <div className="bg-white border border-[#6B7280] rounded-[8px] p-4">
      <div className="text-sm text-[#6B7280] mb-2">Hasil Parse</div>
      <div className="text-lg font-medium">Keripik Balado - 10 pcs @ Rp 4.500</div>
      <div className="text-sm text-[#10B981]">Total: Rp 45.000</div>
    </div>
  );
};

export default NotaParser;
