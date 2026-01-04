import React, { useState, useRef } from 'react';

// Define the shape of a participant, adding a temporary 'id' for stable rendering.
interface UploadParticipant {
  id: number;
  name: string;
  apiEndpoint: string;
  apiKey: string;
}

// Define the props for the modal.
interface CreateTaskModalProps {
  onClose: () => void;
  // The onSubmit function should not receive the temporary 'id'.
  onSubmit: (taskData: { description: string; participants: Omit<UploadParticipant, 'id'>[] }) => void;
  currentUploadName: string;
}

/**
 * A modal for creating a multi-upload task.
 * This corrected version uses stable, unique keys for the participant list,
 * which prevents inputs from losing focus and improves performance during typing.
 */
export default function CreateTaskModal({
  onClose,
  onSubmit,
  currentUploadName
}: CreateTaskModalProps) {
  const [description, setDescription] = useState('');
  
  // Use a ref to generate unique, stable IDs for participants.
  const nextId = useRef(1);
  const [participants, setParticipants] = useState<UploadParticipant[]>([
    // The default participant gets a stable ID of 0.
    { id: 0, name: currentUploadName, apiEndpoint: '', apiKey: '' }
  ]);

  const handleAddParticipant = () => {
    // Add a new participant with a new unique ID.
    setParticipants([...participants, { id: nextId.current++, name: '', apiEndpoint: '', apiKey: '' }]);
  };

  const handleParticipantChange = (
    id: number, // Find and update participants by their stable ID instead of index.
    field: keyof Omit<UploadParticipant, 'id'>,
    value: string
  ) => {
    const newParticipants = participants.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setParticipants(newParticipants);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Before submitting, strip the temporary 'id' field from the participant data.
    const participantsToSubmit = participants.map(({ id, ...rest }) => rest);
    onSubmit({ description, participants: participantsToSubmit });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create New Multi-Upload Task</h2>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Description</label>
            <textarea
              className="w-full rounded-md border border-gray-300 p-3 min-h-[100px]"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task that the uploads should complete..."
              required
              value={description}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Participating Uploads</h3>
              <button
                className="text-blue-600 hover:text-blue-700"
                onClick={handleAddParticipant}
                type="button"
              >
                + Add Upload
              </button>
            </div>

            <div className="space-y-4">
              {/* Use the stable 'participant.id' as the key. */}
              {participants.map((participant) => (
                <div key={participant.id} className="border rounded-lg p-4">
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Upload Name
                      </label>
                      <input
                        className="w-full rounded-md border border-gray-300 p-2"
                        disabled={participant.id === 0} // Disable the default participant.
                        onChange={(e) => handleParticipantChange(participant.id, 'name', e.target.value)}
                        required
                        type="text"
                        value={participant.name}
                      />
                    </div>
                    {participant.id !== 0 && ( // Only show extra fields for non-default participants.
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            API Endpoint
                          </label>
                          <input
                            className="w-full rounded-md border border-gray-300 p-2"
                            onChange={(e) =>
                              handleParticipantChange(participant.id, 'apiEndpoint', e.target.value)
                            }
                            required
                            type="url"
                            value={participant.apiEndpoint}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            API Key
                          </label>
                          <input
                            className="w-full rounded-md border border-gray-300 p-2"
                            onChange={(e) =>
                              handleParticipantChange(participant.id, 'apiKey', e.target.value)
                            }
                            required
                            type="password"
                            value={participant.apiKey}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              type="submit"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
