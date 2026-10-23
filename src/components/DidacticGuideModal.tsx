import React, { useState } from 'react';
import { X, Sparkles, TrendingUp, HelpCircle, DollarSign, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, ArrowRight, BookOpen, Target, Flame } from 'lucide-react';

interface DidacticGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DidacticGuideModal: React.FC<DidacticGuideModalProps> = ({ isOpen, onClose }) => {
  // Calculadora interactiva de cuotas para novatos
  const [calcStake, setCalcStake] = useState<number>(10);
  const [calcOdd, setCalcOdd] = useState<number>(1.85);

  if (!isOpen) return null;

  const totalReturn = (calcStake * (calcOdd || 1)).toFixed(2);
  const netProfit = (calcStake * Math.max(0, (calcOdd || 1) - 1)).toFixed(2);
  const returnPercentage = (((calcOdd || 1) - 1) * 100).toFixed(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0c1322] border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Guía Rápida para Principiantes
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Fácil y Claro
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Aprende en 2 minutos cómo funciona la app, qué significan los números y qué te conviene.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs sm:text-sm">
          
          {/* 1. CALCULADORA INTERACTIVA DE CUOTAS */}
          <section className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-950/80 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-black text-white">1. ¿Qué es una "Cuota" y cuánto ganas en dinero real?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Una cuota (ejemplo <code className="text-amber-300 font-mono bg-black/40 px-1.5 py-0.5 rounded">@1.85</code>) es simplemente un <strong>multiplicador de tu dinero</strong>. Si aciertas, multiplicas lo que pusiste por esa cuota. Pruébalo tú mismo aquí:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">Si juegas (tu dinero):</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min="1"
                    value={calcStake}
                    onChange={(e) => setCalcStake(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-slate-950/70 border border-white/20 rounded-xl py-2 pl-7 pr-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">A una cuota de:</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold">@</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1.01"
                    value={calcOdd}
                    onChange={(e) => setCalcOdd(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
                    className="w-full bg-slate-950/70 border border-white/20 rounded-xl py-2 pl-7 pr-3 text-amber-300 font-mono text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Resultado Financiero */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total que recibes:</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  ${totalReturn}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Ganancia neta limpia:</span>
                <span className="text-base font-black font-mono text-white">
                  +${netProfit} <span className="text-emerald-400 text-xs">({returnPercentage}%)</span>
                </span>
              </div>
            </div>
          </section>

          {/* 2. EL SISTEMA DE SEMÁFOROS DIDÁCTICOS */}
          <section className="space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              2. El Semáforo Didáctico: ¿Qué te conviene y qué no?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Verde */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>🟢 TE CONVIENE</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Existe una <strong>probabilidad alta</strong> o la casa de apuestas está pagando más de lo que debería (<strong>Apuesta de Valor +EV</strong>). Es donde la matemática está a tu favor.
                </p>
              </div>

              {/* Amarillo */}
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>🟡 PRECAUCIÓN</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Partido muy parejo o con riesgo de empate. El consejo de la app te dirá buscar <strong>mercados de goles o puntos</strong> en vez de arriesgar a un ganador incierto.
                </p>
              </div>

              {/* Rojo */}
              <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-rose-400 font-black text-xs">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>🔴 EVITAR / RIESGO</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Mucha incertidumbre o cuota trampa que paga poco para el riesgo de perder. La recomendación es <strong>no apostar en este partido</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* 3. TÉRMINOS EXPLICADOS SIN PALABRAS RARAS */}
          <section className="space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-teal-400" />
              3. ¿Qué significan las palabras comunes?
            </h3>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-900/50 border border-white/10">
                <span className="font-bold text-white text-xs block mb-0.5">
                  ⚽ Más / Menos de 2.5 Goles (Over/Under)
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  ¿Por qué tiene un decimal .5? Para evitar empates. Si el partido termina con <strong>3 goles o más</strong> (ej. 2-1, 3-0, 2-2) se cumple el <em>Más de 2.5</em>. Si termina con <strong>2 goles o menos</strong> (ej. 0-0, 1-0, 1-1) se cumple el <em>Menos de 2.5</em>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-white/10">
                <span className="font-bold text-white text-xs block mb-0.5">
                  🏀 Triples NBA (3PM)
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Son las canastas encestadas desde la línea exterior de tres puntos. La app te proyecta cuántos triples anotarán los dos equipos juntos y quién es el tirador con mayor probabilidad de encestar.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-white/10">
                <span className="font-bold text-white text-xs block mb-0.5">
                  🛡️ Hándicap / Spread en Baloncesto
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Es una ventaja o desventaja imaginaria para nivelar el juego. Por ejemplo, si los Celtics tienen <code className="text-amber-300 font-mono">-6.5 puntos</code>, significa que para ganar deben vencer a su rival por <strong>7 o más puntos</strong> de diferencia.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-white/10">
                <span className="font-bold text-white text-xs block mb-0.5">
                  ✨ Apuesta de Valor (+EV)
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Ocurre cuando la casa de apuestas se equivoca o paga una cuota más alta de la que debería matemáticamente. Imagina que en una moneda que tiene 50% de probabilidad de caer cara te pagan como si tuviera solo el 40%. A largo plazo, el que aprovecha estas cuotas gana dinero.
                </p>
              </div>
            </div>
          </section>

          {/* 4. CONSEJO DE ORO */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-black text-amber-300 block">
                Regla de Oro para el Principiante:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                Nunca juegues dinero que necesites para tus gastos cotidianos. Apuesta montos pequeños (como el valor de un café) y céntrate en seguir los semáforos verdes donde la matemática te acompaña.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            Puedes abrir esta guía en cualquier momento desde el botón superior.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors cursor-pointer"
          >
            ¡Entendido, volver a los partidos!
          </button>
        </div>
      </div>
    </div>
  );
};
