'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import AuthenticatedShell from '@/components/AuthenticatedShell';

interface Risk {
  id: string;
  title: string;
  description: string | null;
  likelihood: string;
  impact: string;
  inherent_score: number;
  residual_score: number | null;
  treatment: string;
  status: string;
  review_due_date: string | null;
}

const scoreColors: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-yellow-100 text-yellow-700',
  5: 'bg-orange-100 text-orange-700',
  6: 'bg-orange-100 text-orange-700',
  8: 'bg-orange-100 text-orange-700',
  9: 'bg-red-100 text-red-700',
  10: 'bg-red-100 text-red-700',
  12: 'bg-red-100 text-red-700',
  15: 'bg-red-100 text-red-700',
  16: 'bg-red-100 text-red-700',
  20: 'bg-red-100 text-red-700',
  25: 'bg-red-100 text-red-700',
};

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    likelihood: 'possible',
    impact: 'moderate',
    treatment: 'mitigate',
    status: 'open',
  });

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      const res = await fetch('/api/risks');
      if (!res.ok) throw new Error('Failed to fetch risks');
      const data = await res.json();
      setRisks(data.risks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to create risk');
      setFormData({
        title: '',
        description: '',
        likelihood: 'possible',
        impact: 'moderate',
        treatment: 'mitigate',
        status: 'open',
      });
      setShowForm(false);
      fetchRisks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this risk?')) return;
    try {
      await fetch(`/api/risks/${id}`, { method: 'DELETE' });
      fetchRisks();
    } catch (err) {
      console.error(err);
    }
  };

  const getScoreColor = (score: number) => {
    const rounded = Math.round(score / 5) * 5;
    return scoreColors[rounded] || 'bg-gray-100 text-gray-700';
  };

  return (
    <RequireAuth>
      <AuthenticatedShell>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Risk Registry</h1>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : 'Add Risk'}
            </button>
          </div>

          {/* Create Risk Form */}
          {showForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">New Risk</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Likelihood</label>
                    <select
                      value={formData.likelihood}
                      onChange={(e) => setFormData({ ...formData, likelihood: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="rare">Rare</option>
                      <option value="unlikely">Unlikely</option>
                      <option value="possible">Possible</option>
                      <option value="likely">Likely</option>
                      <option value="almost_certain">Almost Certain</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Impact</label>
                    <select
                      value={formData.impact}
                      onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="insignificant">Insignificant</option>
                      <option value="minor">Minor</option>
                      <option value="moderate">Moderate</option>
                      <option value="major">Major</option>
                      <option value="catastrophic">Catastrophic</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
                    <select
                      value={formData.treatment}
                      onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="accept">Accept</option>
                      <option value="mitigate">Mitigate</option>
                      <option value="transfer">Transfer</option>
                      <option value="avoid">Avoid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="open">Open</option>
                      <option value="mitigated">Mitigated</option>
                      <option value="accepted">Accepted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Create Risk
                </button>
              </form>
            </div>
          )}

          {/* Risks Table */}
          {loading ? (
            <p className="text-center py-8 text-gray-500">Loading...</p>
          ) : risks.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No risks recorded</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Title</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Likelihood</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Impact</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Score</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Treatment</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">{r.likelihood}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">{r.impact}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(r.inherent_score)}`}>
                          {r.inherent_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{r.treatment}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                          r.status === 'closed' ? 'bg-green-100 text-green-700' :
                          r.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                          r.status === 'mitigated' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
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
