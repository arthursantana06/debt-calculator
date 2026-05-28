import { useState } from 'react';
import { Search, FolderKanban } from 'lucide-react';
import { calculateDebtDetails } from '../utils/calculations';
import type { Debt, Payment } from '../utils/calculations';
import { DebtItem } from './DebtItem';

interface DebtListProps {
  debts: Debt[];
  payments: Payment[];
  onSelectDebt: (debt: Debt) => void;
}

export function DebtList({ debts, payments, onSelectDebt }: DebtListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Filtra as dívidas
  const filteredDebts = debts.filter((debt) => {
    // Busca por descrição/motivo
    return debt.descricao.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reseta a página ao realizar pesquisa
  };

  // Lógica de Paginação
  const totalItems = filteredDebts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDebts = filteredDebts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="w-full px-4 space-y-4">
      {/* Barra de Filtro e Busca */}
      <div className="space-y-3">
        {/* Campo Busca */}
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-zinc-650">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Pesquisar por motivo..."
            className="w-full bg-zinc-950 border border-zinc-900 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus-minimal font-normal"
          />
        </div>
      </div>

      {/* Lista de Cards */}
      <div className="space-y-3.5 pb-2">
        {paginatedDebts.length > 0 ? (
          paginatedDebts.map((debt) => (
            <DebtItem
              key={debt.id}
              debt={debt}
              payments={payments}
              onClick={onSelectDebt}
            />
          ))
        ) : (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-zinc-900 bg-zinc-900/5">
            <FolderKanban className="w-10 h-10 text-zinc-700 mx-auto mb-3 stroke-[1.2]" />
            <h5 className="font-semibold text-zinc-400 text-xs uppercase tracking-wider">Nenhuma dívida encontrada</h5>
            <p className="text-[11px] text-zinc-650 mt-1 max-w-xs mx-auto leading-relaxed">
              {searchTerm 
                ? 'Nenhum resultado corresponde à sua pesquisa.' 
                : 'Cadastre uma nova dívida acima para começar a controlar os saldos.'}
            </p>
          </div>
        )}
      </div>

      {/* Sistema de Paginação Minimalista */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 pb-8 border-t border-zinc-900/60 text-[9px] uppercase tracking-wider font-semibold">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1.5 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900 rounded hover:text-white text-zinc-500 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
          >
            Anterior
          </button>
          
          <span className="text-zinc-500">
            Página <span className="text-zinc-300 font-mono">{currentPage}</span> de <span className="text-zinc-300 font-mono">{totalPages}</span>
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1.5 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900 rounded hover:text-white text-zinc-500 transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
