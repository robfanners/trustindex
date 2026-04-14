'use client';

import { useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import AuthenticatedShell from '@/components/AuthenticatedShell';

interface Control {
  code: string;
  title: string;
  description: string;
}

interface EvidenceLink {
  id: string;
  evidence_type: string;
  evidence_url: string | null;
  evidence_ref: string | null;
  notes: string | null;
}

const ISO_42001_CONTROLS: Control[] = [
  {
    code: 'ISO42001_4',
    title: 'Context of the Organisation',
    description: 'Understanding org context for AI management system',
  },
  {
    code: 'ISO42001_6',
    title: 'Planning for AI Management',
    description: 'Risk assessment and objectives for AI management',
  },
  {
    code: 'ISO42001_8',
    title: 'AI System Lifecycle Operation',
    description: 'Operational planning and control for AI systems',
  },
];

interface SelectedControl {
  control: Control;
  evidenceLinks: EvidenceLink[];
}

export default function ComplianceIso42001Page() {
  const [selectedControl, setSelectedControl] = useState<SelectedControl | null>(null);
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceFormData, setEvidenceFormData] = useState({
    evidence_type: 'document',
    evidence_ref: '',
    evidence_url: '',
    notes: '',
  });

  const selectControl = async (control: Control) => {
    setSelectedControl({ control, evidenceLinks: [] });
    setLoading(true);
    try {
      const res = await fetch(
        `/api/compliance/ISO42001/controls/${control.code}/evidence`
      );
      if (!res.ok) throw new Error('Failed to fetch evidence');
      const data = await res.json();
      setEvidenceLinks(data.evidence_links || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedControl) return;

    try {
      const res = await fetch(
        `/api/compliance/ISO42001/controls/${selectedControl.control.code}/evidence`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evidenceFormData),
        }
      );
      if (!res.ok) throw new Error('Failed to add evidence');
      setEvidenceFormData({
        evidence_type: 'document',
        evidence_ref: '',
        evidence_url: '',
        notes: '',
      });
      setShowEvidenceForm(false);
      selectControl(selectedControl.control);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvidence = async (linkId: string) => {
    if (!selectedControl) return;
    if (!confirm('Delete this evidence link?')) return;

    try {
      await fetch(
        `/api/compliance/ISO42001/controls/${selectedControl.control.code}/evidence/${linkId}`,
        { method: 'DELETE' }
      );
      selectControl(selectedControl.control);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <RequireAuth>
      <AuthenticatedShell>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">ISO 42001 Compliance Mapping</h1>

          <div className="grid grid-cols-3 gap-6">
            {/* Control List */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Controls</h2>
              <div className="space-y-2">
                {ISO_42001_CONTROLS.map((control) => (
                  <button
                    key={control.code}
                    onClick={() => selectControl(control)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                      selectedControl?.control.code === control.code
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{control.code}</div>
                    <div className="text-xs text-gray-600">{control.title}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Control Details */}
            {selectedControl && (
              <div className="col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                  <h2 className="text-2xl font-bold mb-2">{selectedControl.control.code}</h2>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedControl.control.title}
                  </h3>
                  <p className="text-gray-600 mb-4">{selectedControl.control.description}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEvidenceForm(!showEvidenceForm)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm"
                    >
                      {showEvidenceForm ? 'Cancel' : 'Link Evidence'}
                    </button>
                  </div>
                </div>

                {/* Evidence Form */}
                {showEvidenceForm && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4">Add Evidence Link</h3>
                    <form onSubmit={handleAddEvidence} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Evidence Type
                        </label>
                        <select
                          value={evidenceFormData.evidence_type}
                          onChange={(e) =>
                            setEvidenceFormData({
                              ...evidenceFormData,
                              evidence_type: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="attestation">Attestation</option>
                          <option value="document">Document</option>
                          <option value="system_run">System Run</option>
                          <option value="policy">Policy</option>
                          <option value="external_link">External Link</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reference
                        </label>
                        <input
                          type="text"
                          value={evidenceFormData.evidence_ref}
                          onChange={(e) =>
                            setEvidenceFormData({
                              ...evidenceFormData,
                              evidence_ref: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="e.g., DOC-2024-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          URL
                        </label>
                        <input
                          type="url"
                          value={evidenceFormData.evidence_url}
                          onChange={(e) =>
                            setEvidenceFormData({
                              ...evidenceFormData,
                              evidence_url: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={evidenceFormData.notes}
                          onChange={(e) =>
                            setEvidenceFormData({
                              ...evidenceFormData,
                              notes: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm"
                      >
                        Link Evidence
                      </button>
                    </form>
                  </div>
                )}

                {/* Evidence Links */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Evidence Links ({evidenceLinks.length})
                  </h3>
                  {loading ? (
                    <p className="text-gray-500 text-sm">Loading...</p>
                  ) : evidenceLinks.length === 0 ? (
                    <p className="text-gray-500 text-sm">No evidence linked yet</p>
                  ) : (
                    <div className="space-y-3">
                      {evidenceLinks.map((link) => (
                        <div
                          key={link.id}
                          className="border border-gray-200 rounded p-3 flex justify-between items-start"
                        >
                          <div className="flex-1">
                            <div className="flex gap-2 mb-1">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium capitalize">
                                {link.evidence_type}
                              </span>
                            </div>
                            {link.evidence_ref && (
                              <p className="text-sm text-gray-900 font-medium">{link.evidence_ref}</p>
                            )}
                            {link.evidence_url && (
                              <p className="text-sm text-blue-600 truncate">
                                <a href={link.evidence_url} target="_blank" rel="noopener noreferrer">
                                  View
                                </a>
                              </p>
                            )}
                            {link.notes && (
                              <p className="text-sm text-gray-600 mt-1">{link.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteEvidence(link.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </AuthenticatedShell>
    </RequireAuth>
  );
}
