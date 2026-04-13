'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import AuthenticatedShell from '@/components/AuthenticatedShell';

interface AiSighting {
  id: string;
  tool_name: string;
  domain: string | null;
  detected_via: string;
  first_seen: string;
  last_seen: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
}

export default function ShadowAiPage() {
  const [sightings, setSightings] = useState<AiSighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [toolName, setToolName] = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    fetchSightings();
  }, [statusFilter]);

  const fetchSightings = async () => {
    try {
      const res = await fetch('/api/inventory/sightings');
      if (!res.ok) throw new Error('Failed to fetch sightings');
      const data = await res.json();
      let items = data.sightings || [];
      if (statusFilter) {
        items = items.filter((s: AiSighting) => s.status === statusFilter);
      }
      setSightings(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSighting = async () => {
    if (!toolName) return;
    try {
      const res = await fetch('/api/inventory/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolName,
          domain: domain || undefined,
          detected_via: 'manual',
        }),
      });
      if (!res.ok) throw new Error('Failed to add sighting');
      setToolName('');
      setDomain('');
      fetchSightings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/inventory/sightings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchSightings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sighting?')) return;
    try {
      await fetch(`/api/inventory/sightings/${id}`, { method: 'DELETE' });
      fetchSightings();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <RequireAuth>
      <AuthenticatedShell>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Shadow AI Detection</h1>

          {/* Add Sighting Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Add AI Tool Sighting</h2>
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Tool name (e.g., ChatGPT)"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[150px]"
              />
              <input
                type="text"
                placeholder="Domain (optional)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[150px]"
              />
              <button
                onClick={handleAddSighting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Add Sighting
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                statusFilter === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            {['unreviewed', 'approved', 'blocked', 'investigating'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Sightings Table */}
          {loading ? (
            <p className="text-center py-8 text-gray-500">Loading...</p>
          ) : sightings.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No sightings found</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Tool Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Domain</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">First Seen</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Last Seen</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sightings.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.tool_name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.domain || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={s.status}
                          onChange={(e) => handleStatusUpdate(s.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                            s.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : s.status === 'blocked'
                                ? 'bg-red-100 text-red-700'
                                : s.status === 'investigating'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <option value="unreviewed">Unreviewed</option>
                          <option value="approved">Approved</option>
                          <option value="blocked">Blocked</option>
                          <option value="investigating">Investigating</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(s.first_seen).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(s.last_seen).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AuthenticatedShell>
    </RequireAuth>
  );
}
