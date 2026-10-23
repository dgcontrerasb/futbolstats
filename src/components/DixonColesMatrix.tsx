import React, { useState } from 'react';
import { DixonColesResult, MatchFixture } from '../types';
import { Grid, Trophy, Sparkles } from 'lucide-react';

interface DixonColesMatrixProps {
  dixonColes: DixonColesResult;
  fixture: MatchFixture;
}

export const DixonColesMatrix: React.FC<DixonColesMatrixProps> = ({ dixonColes, fixture }) => {
  const [viewMode, setViewMode] = useState<'matrix' | 'topScores'>('matrix');
  const { scoreMatrix, lambdaHome, lambdaAway, mostLikelyScores } = dixonColes;

  // Find max probability in matrix to scale heat colors
  let maxProb = 0;
  scoreMatrix.forEach(row => {
    row.forEach(val => {
      if (val > maxProb) maxProb = val;
    });
  });

  return (
    <div className="space-y-4">
      {/* Parameter Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-800">
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Lambda Local (λ₁)</span>
          <span className="text-emerald-400 font-bold text-sm">{lambdaHome.toFixed(2)} xG</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Lambda Visita (λ₂)</span>
          <span className="text-blue-400 font-bold text-sm">{lambdaAway.toFixed(2)} xG</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Ajuste Rho (ρ)</span>
          <span className="text-slate-200 font-bold text-sm">-0.11 (Dixon-Coles)</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px] uppercase">Bono Localía</span>
          <span className="text-emerald-400 font-bold text-sm">+15.0%</span>
        </div>
      </div>

      {/* Header with Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Grid className="w-3.5 h-3.5 text-emerald-400" />
          <span>Matriz de Probabilidad Conjunta (Goles 0 a 6)</span>
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-md border border-slate-800 text-[11px] font-mono">
          <button
            onClick={() => setViewMode('matrix')}
            className={`px-2 py-0.5 rounded transition-colors ${
              viewMode === 'matrix' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Matriz 7x7
          </button>
          <button
            onClick={() => setViewMode('topScores')}
            className={`px-2 py-0.5 rounded transition-colors ${
              viewMode === 'topScores' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Top Marcadores
          </button>
        </div>
      </div>

      {viewMode === 'matrix' ? (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[460px]">
            {/* Top axis label (Away goals) */}
            <div className="text-center text-[11px] font-mono text-blue-400 pb-1 flex items-center justify-center gap-1">
              <span>Goles Visitante: {fixture.awayTeam.shortName} →</span>
            </div>

            <div className="flex">
              {/* Left axis label (Home goals) */}
              <div className="w-6 flex items-center justify-center text-[11px] font-mono text-emerald-400 -rotate-90 whitespace-nowrap">
                ← {fixture.homeTeam.shortName}
              </div>

              {/* Table */}
              <div className="flex-1">
                <table className="w-full border-collapse text-center text-xs font-mono">
                  <thead>
                    <tr>
                      <th className="p-1 text-[10px] text-slate-400 bg-slate-900/60 border border-slate-800/80">L \ V</th>
                      {[0, 1, 2, 3, 4, 5, 6].map(y => (
                        <th key={y} className="p-1 text-[11px] text-blue-300 font-bold bg-slate-900/60 border border-slate-800/80">
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scoreMatrix.map((row, x) => (
                      <tr key={x}>
                        <td className="p-1 text-[11px] text-emerald-300 font-bold bg-slate-900/60 border border-slate-800/80">
                          {x}
                        </td>
                        {row.map((prob, y) => {
                          const isMostProbable = mostLikelyScores[0]?.home === x && mostLikelyScores[0]?.away === y;
                          const isTop3 = mostLikelyScores.slice(0, 3).some(s => s.home === x && s.away === y);
                          // Calculate background opacity based on probability
                          const intensity = maxProb > 0 ? prob / maxProb : 0;
                          const bgStyle = isMostProbable
                            ? 'rgba(16, 185, 129, 0.45)'
                            : intensity > 0.6
                            ? 'rgba(16, 185, 129, 0.25)'
                            : intensity > 0.25
                            ? 'rgba(59, 130, 246, 0.18)'
                            : 'rgba(30, 41, 59, 0.25)';

                          return (
                            <td
                              key={y}
                              style={{ backgroundColor: bgStyle }}
                              className={`p-1.5 border border-slate-800/80 transition-colors relative group ${
                                isMostProbable
                                  ? 'ring-2 ring-emerald-400 text-emerald-200 font-bold z-10'
                                  : isTop3
                                  ? 'font-semibold text-slate-100'
                                  : 'text-slate-300'
                              }`}
                              title={`${fixture.homeTeam.shortName} ${x} - ${y} ${fixture.awayTeam.shortName}: ${prob.toFixed(1)}%`}
                            >
                              <span>{prob.toFixed(1)}%</span>
                              {isMostProbable && (
                                <span className="absolute -top-1.5 -right-1 text-[9px] bg-emerald-500 text-black px-1 rounded font-bold shadow">
                                  ★
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {mostLikelyScores.map((item, idx) => (
            <div
              key={item.score}
              className={`p-3 rounded-lg border font-mono flex items-center justify-between ${
                idx === 0
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
                }`}>
                  {idx + 1}
                </span>
                <span className="text-base font-bold tracking-wider">{item.score}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">{item.probability.toFixed(1)}%</span>
                <span className="block text-[10px] text-slate-400">
                  Cuota: {(100 / Math.max(0.1, item.probability)).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Methodology footnote */}
      <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-1 border-t border-slate-800/60">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          Ajuste Dixon-Coles aplicado: los resultados de baja anotación (0-0, 1-0, 0-1, 1-1) corrigen la correlación estadística entre ambos clubes usando el parámetro empírico ρ=-0.11.
        </span>
      </div>
    </div>
  );
};
