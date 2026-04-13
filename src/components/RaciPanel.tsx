'use client';

import { useEffect, useState } from 'react';

interface RaciAssignment {
  id: string;
  user_id: string;
  role: 'responsible' | 'accountable' | 'consulted' | 'informed';
}

interface User {
  id: string;
  full_name: string;
}

interface RaciPanelProps {
  entityType: 'system' | 'control' | 'risk' | 'policy' | 'incident';
  entityId: string;
}

export function RaciPanel({ entityType, entityId }: RaciPanelProps) {
  const [assignments, setAssignments] = useState<RaciAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'responsible' | 'accountable' | 'consulted' | 'informed'>('responsible');
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    fetchAssignments();
    fetchUsers();
  }, [entityType, entityId]);

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`/api/raci?entity_type=${entityType}&entity_id=${entityId}`);
      if (!res.ok) throw new Error('Failed to fetch RACI assignments');
      const data = await res.json();
      setAssignments(data.raci_assignments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // This would need an endpoint to list org users
      // For now, we'll keep it simple
      setUsers([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedUserId) return;
    try {
      const res = await fetch('/api/raci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          user_id: selectedUserId,
          role: selectedRole,
        }),
      });
      if (!res.ok) throw new Error('Failed to add assignment');
      setSelectedUserId('');
      fetchAssignments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/raci/${id}`, { method: 'DELETE' });
      fetchAssignments();
    } catch (err) {
      console.error(err);
    }
  };

  const roleColors: Record<string, string> = {
    responsible: 'bg-blue-100 text-blue-700',
    accountable: 'bg-purple-100 text-purple-700',
    consulted: 'bg-yellow-100 text-yellow-700',
    informed: 'bg-gray-100 text-gray-700',
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading RACI...</p>;

  const grouped = {
    responsible: assignments.filter((a) => a.role === 'responsible'),
    accountable: assignments.filter((a) => a.role === 'accountable'),
    consulted: assignments.filter((a) => a.role === 'consulted'),
    informed: assignments.filter((a) => a.role === 'informed'),
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">RACI Matrix</h3>

      {/* Assignments Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {Object.entries(grouped).map(([role, items]) => (
          <div key={role} className="border border-gray-200 rounded p-3">
            <div className={`text-xs font-semibold uppercase mb-2 px-2 py-1 rounded ${roleColors[role]}`}>
              {role === 'accountable' ? 'Accountable' : role === 'responsible' ? 'Responsible' : role === 'consulted' ? 'Consulted' : 'Informed'}
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-xs text-gray-500">Unassigned</p>
              ) : (
                items.map((a) => (
                  <div key={a.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs">
                    <span className="text-gray-700">User ID: {a.user_id.substring(0, 8)}</span>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Assignment */}
      <div className="border-t pt-4">
        <p className="text-xs text-gray-600 mb-2">Add assignment</p>
        <div className="flex gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'responsible' | 'accountable' | 'consulted' | 'informed')}
            className="px-2 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="responsible">Responsible</option>
            <option value="accountable">Accountable</option>
            <option value="consulted">Consulted</option>
            <option value="informed">Informed</option>
          </select>
          <input
            type="text"
            placeholder="User ID"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-xs flex-1"
          />
          <button
            onClick={handleAddAssignment}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
