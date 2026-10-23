import React from 'react';
import { CompetitionGroup } from '../services/leagueCategorizer';
import { MatchFixture, MatchAnalysis } from '../types';
import { FriendlyPredictionCard } from './FriendlyPredictionCard';
import { ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';

interface CompetitionBlockProps {
  group: CompetitionGroup;
  analysesMap: Record<string, MatchAnalysis>;
  selectedFixtureIds: Set<string>;
  expandedCardIds: Set<string>;
  isGroupCollapsed: boolean;
  viewMode: 'SIMPLE' | 'EXPERT';
  isLightweightMode?: boolean;
  onToggleGroupCollapse: (groupKey: string) => void;
  onToggleSelectFixture: (fixtureId: string) => void;
  onToggleSelectGroupFixtures: (fixtureIds: string[], selectAll: boolean) => void;
  onOpenSimulator: (fixture: MatchFixture) => void;
  onToggleCardExpand: (fixtureId: string) => void;
}

export const CompetitionBlock: React.FC<CompetitionBlockProps> = ({
  group,
  analysesMap,
  selectedFixtureIds,
  expandedCardIds,
  isGroupCollapsed,
  viewMode,
  isLightweightMode = false,
  onToggleGroupCollapse,
  onToggleSelectFixture,
  onToggleSelectGroupFixtures,
  onOpenSimulator,
  onToggleCardExpand
}) => {
  const groupFixtureIds = group.fixtures.map(f => f.id);
  const selectedInGroupCount = groupFixtureIds.filter(id => selectedFixtureIds.has(id)).length;
  const allSelectedInGroup = groupFixtureIds.length > 0 && selectedInGroupCount === groupFixtureIds.length;
  const someSelectedInGroup = selectedInGroupCount > 0 && !allSelectedInGroup;
  const hasLiveMatches = group.fixtures.some(f => f.status === 'IN_PLAY');

  const handleToggleSelectAllInGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelectGroupFixtures(groupFixtureIds, !allSelectedInGroup);
  };

  // If the group only contains a single league, show that league's name directly as the title!
  const displayTitle = group.leagues.length === 1 ? group.leagues[0].name : group.name;

  return (
    <div className="border border-[#30363d] rounded-lg overflow-hidden shadow-xl bg-[#161b22] transition-all">
      {/* Header Bar */}
      <div
        onClick={() => onToggleGroupCollapse(group.key)}
        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-[#161b22] hover:bg-[#1c2129] flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none border-b border-[#30363d] transition-colors"
      >
        {/* Left: Flag/Icon + Title + Badges */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-sm shrink-0 shadow-inner">
            {group.flag}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                {displayTitle}
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums font-bold bg-[#00ff66]/10 border border-[#00ff66]/30 text-[#00ff66]">
                {group.fixtures.length} {group.fixtures.length === 1 ? 'partido' : 'partidos'}
              </span>
              {hasLiveMatches && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-bold text-[10px] animate-pulse">
                  🔴 En Vivo
                </span>
              )}
            </div>

            {/* Sub-leagues chips ONLY if multiple leagues in the group */}
            {group.leagues.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                {group.leagues.slice(0, 3).map((l, idx) => (
                  <span key={String(l.id || idx)} className="inline-flex items-center gap-1">
                    <span className="text-slate-300 font-medium">{l.name}</span>
                    <span className="text-slate-500">({l.matchCount})</span>
                    {idx < Math.min(group.leagues.length, 3) - 1 && <span className="text-slate-600">·</span>}
                  </span>
                ))}
                {group.leagues.length > 3 && (
                  <span className="text-slate-500">+{group.leagues.length - 3} más</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick actions (Select all in league & Collapse chevron) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Select all in league */}
          <button
            type="button"
            onClick={handleToggleSelectAllInGroup}
            className={`px-2 py-1 rounded-md text-xs font-mono tabular-nums font-bold flex items-center gap-1.5 transition-colors border cursor-pointer ${
              allSelectedInGroup
                ? 'bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/40 hover:bg-[#00ff66]/25'
                : someSelectedInGroup
                ? 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30'
                : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-white hover:bg-[#30363d]'
            }`}
            title={allSelectedInGroup ? 'Deseleccionar todos en esta liga' : 'Seleccionar todos en esta liga'}
          >
            {allSelectedInGroup ? (
              <CheckSquare className="w-3.5 h-3.5 text-[#00ff66]" />
            ) : someSelectedInGroup ? (
              <Square className="w-3.5 h-3.5 text-[#00ff66] fill-[#00ff66]/30" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {allSelectedInGroup ? 'Liga lista' : someSelectedInGroup ? `${selectedInGroupCount}/${groupFixtureIds.length}` : 'Seleccionar'}
            </span>
          </button>

          {/* Expand/Collapse Chevron Button */}
          <button
            type="button"
            className="p-1 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white transition-colors border border-[#30363d]"
            aria-label={isGroupCollapsed ? 'Expandir grupo' : 'Colapsar grupo'}
          >
            {isGroupCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[#00ff66]" />
            )}
          </button>
        </div>
      </div>

      {/* Fixtures Container (Collapsible) */}
      {!isGroupCollapsed && (
        <div className="p-2 sm:p-3 space-y-2.5 bg-[#0b0e14]">
          {group.fixtures.map(fixture => {
            const analysis = analysesMap[fixture.id];
            if (!analysis) return null;
            return (
              <FriendlyPredictionCard
                key={fixture.id}
                fixture={fixture}
                analysis={analysis}
                isSelected={selectedFixtureIds.has(fixture.id)}
                onToggleSelect={onToggleSelectFixture}
                onOpenSimulator={onOpenSimulator}
                isExpanded={expandedCardIds.has(fixture.id)}
                onToggleExpand={() => onToggleCardExpand(fixture.id)}
                viewMode={viewMode}
                mobileLightweight={isLightweightMode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
