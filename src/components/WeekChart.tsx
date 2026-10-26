import React from 'react';

const WeekChart: React.FC = () => {
  return (
    <div className="bg-white border border-[#6B7280] rounded-[8px] p-4">
      <div className="text-sm text-[#6B7280] mb-3">8 Minggu Penjualan</div>
      <div className="h-40 flex items-end gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex-1 bg-[#10B981] rounded-t" style={{ height: `${50 + Math.random() * 30}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-[#6B7280] mt-2">
        <div>1</div>
        <div>2</div>
        <div>3</div>
        <div>4</div>
        <div>5</div>
        <div>6</div>
        <div>7</div>
        <div>8</div>
      </div>
    </div>
  );
};

export default WeekChart;
