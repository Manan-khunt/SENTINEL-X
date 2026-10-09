// Tamper-evident audit. Integrity verdict comes from the backend
// verify_audit_chain — never computed on the client.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorBox, Loading, Panel, errMsg } from '../components/ui';

export function AuditPage() {
  const [filter, setFilter] = useState('');
  const list = useQuery({ queryKey: ['audit'], queryFn: api.auditList });
  const verify = useQuery({
    queryKey: ['audit-verify', filter || 'all'],
    queryFn: () => api.auditVerify(filter || undefined),
  });

  const rows = (list.data || []).filter(
    (r) =>
      !filter ||
      (r.incident_id || '').toLowerCase().includes(filter.toLowerCase()) ||
      r.event.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="flex gap-3 p-3 h-full min-h-0">
      <Panel
        title="TAMPER-EVIDENT AUDIT"
        className="flex-1"
        right={
          verify.data ? (
            <span
              className={`font-mono text-[11px] font-bold ${
                verify.data.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              CHAIN {verify.data.status}
              {verify.data.broken_at ? ` AT ENTRY ${verify.data.broken_at}` : ''}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-[#8FA0BF]">verifying…</span>
          )
        }
      >
        <div className="p-2 border-b border-[#22304D] flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by incident or event…"
            className="flex-1 bg-[#16223B] border border-[#22304D] rounded px-2 py-1.5 text-xs font-mono text-[#E6EDF7] outline-none"
          />
        </div>
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorBox message={errMsg(list.error)} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <Empty message="No audit entries match." />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="font-mono text-[10px] text-[#8FA0BF] tracking-wider text-left border-b border-[#22304D] sticky top-0 bg-[#111A2E]">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">INCIDENT</th>
                <th className="px-3 py-2">ACTOR</th>
                <th className="px-3 py-2">EVENT</th>
                <th className="px-3 py-2">HASH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#22304D]/50 hover:bg-[#16223B]">
                  <td className="px-3 py-1.5 font-mono text-[#8FA0BF]">#{r.id}</td>
                  <td className="px-3 py-1.5 font-mono text-[#E6EDF7]">{r.incident_id || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-[#E6EDF7]">{r.actor}</td>
                  <td className="px-3 py-1.5 font-mono text-[#0E7C86]">{r.event}</td>
                  <td className="px-3 py-1.5 font-mono text-[#8FA0BF]" title={r.hash}>
                    {r.hash.slice(0, 12)}… ← {r.previous_hash.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
