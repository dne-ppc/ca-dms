import React, { useState } from 'react'
import { PenTool, Users, Send, CheckCircle } from 'lucide-react'

interface DigitalSignatureButtonProps {
  documentId?: string
  onRequestSignature?: (participants: SignatureParticipant[]) => void
  disabled?: boolean
}

interface SignatureParticipant {
  email: string
  name: string
  role: 'signer' | 'approver' | 'witness' | 'cc'
  signing_order: number
}

export const DigitalSignatureButton: React.FC<DigitalSignatureButtonProps> = ({
  documentId,
  onRequestSignature,
  disabled = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [participants, setParticipants] = useState<SignatureParticipant[]>([
    { email: '', name: '', role: 'signer', signing_order: 1 }
  ])
  const [isLoading, setIsLoading] = useState(false)

  const handleRequestSignature = () => {
    if (!documentId) {
      alert('Please save the document first before requesting signatures')
      return
    }
    setIsModalOpen(true)
  }

  const addParticipant = () => {
    setParticipants([
      ...participants,
      {
        email: '',
        name: '',
        role: 'signer',
        signing_order: participants.length + 1
      }
    ])
  }

  const removeParticipant = (index: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index))
    }
  }

  const updateParticipant = (index: number, field: keyof SignatureParticipant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  const handleSubmit = async () => {
    // Validate participants
    const validParticipants = participants.filter(p => p.email.trim() && p.name.trim())
    if (validParticipants.length === 0) {
      alert('Please add at least one participant with email and name')
      return
    }

    setIsLoading(true)
    try {
      // Here we would call the signature service
      // For now, just call the callback
      if (onRequestSignature) {
        await onRequestSignature(validParticipants)
      }

      alert('Signature request sent successfully!')
      setIsModalOpen(false)
    } catch (error) {
      alert('Failed to send signature request: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        data-testid="digital-signature-button"
        onClick={handleRequestSignature}
        disabled={disabled}
        className={`
          p-2 rounded-md transition-colors flex items-center gap-2
          ${disabled
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
          }
        `}
        title="Request Digital Signature"
      >
        <PenTool className="h-4 w-4" />
        <span className="hidden md:inline text-sm">Sign</span>
      </button>

      {/* Signature Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-blue-600" />
                  Request Digital Signature
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Add participants who need to sign this document. They will receive an email
                    with a secure link to review and sign the document.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Participants ({participants.length})
                    </h3>
                    <button
                      onClick={addParticipant}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add Participant
                    </button>
                  </div>

                  {participants.map((participant, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Participant {index + 1}</span>
                        {participants.length > 1 && (
                          <button
                            onClick={() => removeParticipant(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={participant.name}
                            onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Full name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email *
                          </label>
                          <input
                            type="email"
                            value={participant.email}
                            onChange={(e) => updateParticipant(index, 'email', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="email@example.com"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role
                          </label>
                          <select
                            value={participant.role}
                            onChange={(e) => updateParticipant(index, 'role', e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="signer">Signer</option>
                            <option value="approver">Approver</option>
                            <option value="witness">Witness</option>
                            <option value="cc">CC (Receive Copy)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Signing Order
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={participant.signing_order}
                            onChange={(e) => updateParticipant(index, 'signing_order', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className={`
                      px-4 py-2 rounded-md text-white flex items-center gap-2
                      ${isLoading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                      }
                    `}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Signature Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}