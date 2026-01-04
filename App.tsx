// --- AFTER (preferred)
import { useAppStore } from './store/useAppStore';

const addScheduleItem = useAppStore(state => state.addScheduleItem);
const removeScheduleItem = useAppStore(state => state.deleteScheduleItem); // used for rollback if needed

const handleSaveTask = useCallback(async (task: ScheduleItem) => {
  if (!useAppStore.getState().currentUser) return;
  setIsSyncing(true);

  // Generate a client-side ID if missing (server stores by logical ID inside the item)
  const createdItem = { ...task, ID: task.ID || `C${Date.now()}` };

  // Optimistic update - reflect immediately in UI
  try {
    addScheduleItem(createdItem);

    // Call backend
    await api.saveTask(createdItem); // ensure api.saveTask(task) sends the logical ID in body

    // Optionally: if you want canonical server state, call refreshUser()
    // await refreshUser();

    // Done: UI already updated
  } catch (error) {
    console.error("Failed to save task (rolling back optimistic update):", error);

    // Rollback optimistic update (remove by ID)
    try {
      removeScheduleItem(createdItem.ID);
    } catch (inner) {
      console.error('Rollback failed - refreshing user as fallback', inner);
      await refreshUser(); // fallback to server state
    }

    alert("Failed to save task. Please try again or check backend connection.");
  } finally {
    setIsSyncing(false);
  }
}, [addScheduleItem, removeScheduleItem, refreshUser]);