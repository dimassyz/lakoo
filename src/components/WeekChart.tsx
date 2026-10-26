import React from "react";

const WeekChart: React.FC = () => {
  return (
    <div className="rounded-[8px] border border-[#6B7280] bg-white p-4">
      <div className="mb-3 text-sm text-[#6B7280]">8 Minggu Penjualan</div>
      <div className="flex h-40 items-end gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[#10B981]"
            style={{ height: `${50 + Math.random() * 30}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-[#6B7280]">
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
