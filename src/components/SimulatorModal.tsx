import React, { useState, useMemo, useEffect } from 'react';
import { X, Sliders, Play, RotateCcw, Sparkles } from 'lucide-react';
import { MatchFixture, TeamInfo } from '../types';
import { calculateMatchAnalysis } from '../services/mathEngine';
import { DixonColesMatrix } from './DixonColesMatrix';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFixture?: MatchFixture | null;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  initialFixture
}) => {
  // Custom adjustable parameters
  const [homeName, setHomeName] = useState(initialFixture?.homeTeam.name || 'Real Madrid CF');
  const [awayName, setAwayName] = useState(initialFixture?.awayTeam.name || 'FC Barcelona');
  const [homeAttack, setHomeAttack] = useState(initialFixture?.homeTeam.attackStrength || 1.45);
  const [homeDefense, setHomeDefense] = useState(initialFixture?.homeTeam.defenseStrength || 0.80);
  const [awayAttack, setAwayAttack] = useState(initialFixture?.awayTeam.attackStrength || 1.40);
  const [awayDefense, setAwayDefense] = useState(initialFixture?.awayTeam.defenseStrength || 0.85);

  const [homeAdvantage, setHomeAdvantage] = useState(15); // %
  const [homeRest, setHomeRest] = useState(initialFixture?.homeTeam.restHours || 96);
  const [awayRest, setAwayRest] = useState(initialFixture?.awayTeam.restHours || 72);
  const [awayTravelKm, setAwayTravelKm] = useState(initialFixture?.travel.awayDistanceKm || 620);
  const [refereeRigor, setRefereeRigor] = useState<'Severo' | 'Moderado' | 'Flexible'>(
    initialFixture?.referee.rigor || 'Severo'
  );
  const [isDerby, setIsDerby] = useState(initialFixture?.derbyOrRivalry ?? true);

  useEffect(() => {
    if (!isOpen) return;

    setHomeName(initialFixture?.homeTeam.name || 'Real Madrid CF');
    setAwayName(initialFixture?.awayTeam.name || 'FC Barcelona');
    setHomeAttack(initialFixture?.homeTeam.attackStrength ?? 1.45);
    setHomeDefense(initialFixture?.homeTeam.defenseStrength ?? 0.80);
    setAwayAttack(initialFixture?.awayTeam.attackStrength ?? 1.40);
    setAwayDefense(initialFixture?.awayTeam.defenseStrength ?? 0.85);
    setHomeAdvantage(initialFixture?.homeAdvantage ?? 15);
    setHomeRest(initialFixture?.homeTeam.restHours ?? 96);
    setAwayRest(initialFixture?.awayTeam.restHours ?? 72);
    setAwayTravelKm(initialFixture?.travel.awayDistanceKm ?? 620);
    setRefereeRigor(initialFixture?.referee.rigor || 'Severo');
    setIsDerby(initialFixture?.derbyOrRivalry ?? true);
  }, [isOpen, initialFixture]);

  // Synthesize custom simulated fixture
  const simulatedFixture: MatchFixture = useMemo(() => {
    const homeTeam: TeamInfo = {
      id: 991,
      name: homeName,
      shortName: homeName.split(' ')[0],
      logo: 'https://media.api-sports.io/football/teams/541.png',
      rank: 1,
      points: 68,
      form: ['W', 'W', 'D', 'W', 'W'],
      attackStrength: homeAttack,
      defenseStrength: homeDefense,
      avgShotsPerMatch: 16.0,
      avgShotsOnTarget: 6.5,
      restHours: homeRest,
      starPlayer: {
        name: 'Goleador Estrella Local',
        position: 'Delantero',
        goalsSeason: 22,
        expectedShots: 4.0,
        expectedShotsOnTarget: 2.0,
        goalConversionRate: 0.30
      }
    };

    const awayTeam: TeamInfo = {
      id: 992,
      name: awayName,
      shortName: awayName.split(' ')[0],
      logo: 'https://media.api-sports.io/football/teams/529.png',
      rank: 2,
      points: 65,
      form: ['W', 'W', 'W', 'L', 'W'],
      attackStrength: awayAttack,
      defenseStrength: awayDefense,
      avgShotsPerMatch: 15.0,
      avgShotsOnTarget: 6.0,
      restHours: awayRest,
      starPlayer: {
        name: 'Goleador Estrella Visitante',
        position: 'Delantero',
        goalsSeason: 19,
        expectedShots: 3.8,
        expectedShotsOnTarget: 1.8,
        goalConversionRate: 0.28
      }
    };

    return {
      id: 'sim-1',
      date: '2026-10-04',
      time: '21:00',
      status: 'SCHEDULED',
      league: {
        id: 1,
        name: 'Laboratorio de Simulación Táctica',
        country: 'Pro',
        flag: '🔬',
        round: 'Experimento Dixon-Coles',
        avgGoalsPerMatch: 2.75,
        avgCardsPerMatch: 4.8
      },
      homeTeam,
      awayTeam,
      referee: {
        name: refereeRigor === 'Severo' ? 'Árbitro Severo' : refereeRigor === 'Flexible' ? 'Árbitro Flexible' : 'Árbitro Moderado',
        nationality: 'Internacional',
        rigor: refereeRigor,
        avgYellowCards: refereeRigor === 'Severo' ? 5.8 : refereeRigor === 'Flexible' ? 3.5 : 4.4,
        avgRedCards: 0.28,
        foulsPerCard: 4.2
      },
      venue: {
        name: 'Estadio Virtual Lab',
        city: 'Simulación',
        capacity: 70000
      },
      travel: {
        awayDistanceKm: awayTravelKm,
        awayFlightHours: awayTravelKm / 500
      },
      homeAdvantage,
      derbyOrRivalry: isDerby
    };
  }, [
    homeName,
    awayName,
    homeAttack,
    homeDefense,
    awayAttack,
    awayDefense,
    homeRest,
    awayRest,
    awayTravelKm,
    homeAdvantage,
    refereeRigor,
    isDerby
  ]);

  const analysis = useMemo(() => {
    return calculateMatchAnalysis(simulatedFixture, false);
  }, [simulatedFixture]);

  const resetDefaults = () => {
    setHomeName('Real Madrid CF');
    setAwayName('FC Barcelona');
    setHomeAttack(1.45);
    setHomeDefense(0.80);
    setAwayAttack(1.40);
    setAwayDefense(0.85);
    setHomeAdvantage(15);
    setHomeRest(96);
    setAwayRest(72);
    setAwayTravelKm(600);
    setRefereeRigor('Severo');
    setIsDerby(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#121A2B] border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Laboratorio Matemático & Simulador Dixon-Coles
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta parámetros tácticos y observa el recálculo estocástico instantáneo en la matriz 7x7.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Team Names Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-emerald-400 block mb-1">Equipo Local</label>
              <input
                type="text"
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 text-sm text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-blue-400 block mb-1">Equipo Visitante</label>
              <input
                type="text"
                value={awayName}
                onChange={(e) => setAwayName(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 text-sm text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            {/* Home Attack */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Poder Ofensivo Local</span>
                <span className="text-emerald-400 font-bold">{homeAttack.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="2.0"
                step="0.05"
                value={homeAttack}
                onChange={(e) => setHomeAttack(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Home Defense */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Vulnerabilidad Def. Local</span>
                <span className="text-slate-200 font-bold">{homeDefense.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={homeDefense}
                onChange={(e) => setHomeDefense(parseFloat(e.target.value))}
                className="w-full accent-slate-400 cursor-pointer"
              />
            </div>

            {/* Home Advantage */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Ventaja de Localía</span>
                <span className="text-emerald-400 font-bold">+{homeAdvantage}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={homeAdvantage}
                onChange={(e) => setHomeAdvantage(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Away Attack */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Poder Ofensivo Visita</span>
                <span className="text-blue-400 font-bold">{awayAttack.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="2.0"
                step="0.05"
                value={awayAttack}
                onChange={(e) => setAwayAttack(parseFloat(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Away Defense */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Vulnerabilidad Def. Visita</span>
                <span className="text-slate-200 font-bold">{awayDefense.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={awayDefense}
                onChange={(e) => setAwayDefense(parseFloat(e.target.value))}
                className="w-full accent-slate-400 cursor-pointer"
              />
            </div>

            {/* Away Rest Hours */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Descanso Visitante</span>
                <span className={awayRest < 72 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                  {awayRest}h {awayRest < 72 && '(Fatiga)'}
                </span>
              </div>
              <input
                type="range"
                min="48"
                max="168"
                step="4"
                value={awayRest}
                onChange={(e) => setAwayRest(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Away Travel */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Traslado Visitante (km)</span>
                <span className="text-slate-200 font-bold">{awayTravelKm} km</span>
              </div>
              <input
                type="range"
                min="50"
                max="3000"
                step="50"
                value={awayTravelKm}
                onChange={(e) => setAwayTravelKm(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Referee Rigor */}
            <div>
              <span className="text-slate-300 block mb-1">Rigor del Árbitro</span>
              <div className="flex gap-1">
                {(['Flexible', 'Moderado', 'Severo'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRefereeRigor(r)}
                    className={`flex-1 py-1 text-center rounded border transition-colors ${
                      refereeRigor === r
                        ? 'bg-slate-700 text-white border-slate-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Derby toggle */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-slate-300">¿Tensión de Derbi?</span>
              <button
                type="button"
                onClick={() => setIsDerby(!isDerby)}
                className={`px-3 py-1 rounded font-bold transition-colors ${
                  isDerby ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isDerby ? 'SÍ (+25% fricción)' : 'NO (Estándar)'}
              </button>
            </div>
          </div>

          {/* Quick Result Preview Bar */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-bold">
                1 ({homeName}): {analysis.dixonColes.pHomeWin}% (@{analysis.dixonColes.fairOddsHome.toFixed(2)})
              </span>
              <span className="text-slate-300 font-bold">
                X: {analysis.dixonColes.pDraw}% (@{analysis.dixonColes.fairOddsDraw.toFixed(2)})
              </span>
              <span className="text-blue-400 font-bold">
                2 ({awayName}): {analysis.dixonColes.pAwayWin}% (@{analysis.dixonColes.fairOddsAway.toFixed(2)})
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex">
              <div style={{ width: `${analysis.dixonColes.pHomeWin}%` }} className="bg-[#10B981]" />
              <div style={{ width: `${analysis.dixonColes.pDraw}%` }} className="bg-[#64748B]" />
              <div style={{ width: `${analysis.dixonColes.pAwayWin}%` }} className="bg-[#3B82F6]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-300 pt-1">
              <div>xG Local: <strong className="text-emerald-400">{analysis.dixonColes.lambdaHome.toFixed(2)}</strong></div>
              <div>xG Visita: <strong className="text-blue-400">{analysis.dixonColes.lambdaAway.toFixed(2)}</strong></div>
              <div>BTTS Sí: <strong className="text-slate-200">{analysis.goalsMarket.bttsYes}%</strong></div>
              <div>Amarillas: <strong className="text-amber-400">{analysis.refereeCards.expectedYellowCards}</strong></div>
            </div>
          </div>

          {/* Dixon-Coles Matrix Component */}
          <div>
            <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">Matriz Dixon-Coles Recalculada:</h4>
            <DixonColesMatrix dixonColes={analysis.dixonColes} fixture={simulatedFixture} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={resetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer valores por defecto</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Aplicar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
