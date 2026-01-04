// --- AFTER (recommended)
import { useAppStore } from '../store/useAppStore';
import { api } from '../api/apiService'; // Added import for api calls
import { ScheduleItem } from '../types'; // Assuming ScheduleItem is defined here, or adjust import if needed
import React, { useEffect } from 'react'; // Re-adding React and useEffect imports in case they were lost

function StudentDashboard(props) {
  const { updateScheduleItem } = useAppStore(); // Get action from store

  // New handler for starring tasks
  const handleStarTask = async (taskId: string) => {
    const { currentUser } = useAppStore.getState(); // Get current user state directly
    const task = currentUser?.SCHEDULE_ITEMS.find(t => t.ID === taskId);
    if (task) {
        const updatedTask = { ...task, isStarred: !task.isStarred };
        
        // Optimistic update
        updateScheduleItem(taskId, { isStarred: updatedTask.isStarred });
        
        try {
            // Call backend to persist the change
            await api.saveTask(updatedTask);
        } catch (error) {
            // If the API call fails, roll back the optimistic update
            console.error("Failed to update star status for task:", error);
            updateScheduleItem(taskId, { isStarred: task.isStarred }); // Revert the change
        }
    }
  };
  const scheduleItems = useAppStore(state => state.currentUser?.SCHEDULE_ITEMS || []);
  const studentConfig = useAppStore(state => state.currentUser?.CONFIG);

  // Effects should depend on scheduleItems (the store value) not on a detached 'student' prop
  useEffect(() => {
    // Alarms using scheduleItems
  }, [scheduleItems]);

  return (
    <div>
      <SubjectAllocationWidget items={scheduleItems} />
      <TodaysAgendaWidget items={scheduleItems} onStar={handleStarTask} />
      <ScheduleList 
        items={scheduleItems} 
        onStar={handleStarTask}
        // These props are placeholders. You'll need to implement the actual logic for them
        // using useAppStore actions or local component state as appropriate for the new architecture.
        onDelete={() => console.log("onDelete called")} 
        onEdit={() => console.log("onEdit called")} 
        onMoveToNextDay={() => console.log("onMoveToNextDay called")} 
        onStartPractice={() => console.log("onStartPractice called")} 
        isSubscribed={studentConfig?.UNACADEMY_SUB || false} 
        onStartReviewSession={() => console.log("onStartReviewSession called")}
        onCompleteTask={() => console.log("onCompleteTask called")} 
        view={"upcoming"} // This should probably come from state or store
        onViewChange={() => console.log("onViewChange called")} 
        isSelectMode={false} // This should probably come from state or store
        selectedTaskIds={[]} // This should probably come from state or store
        onTaskSelect={() => console.log("onTaskSelect called")} 
        onToggleSelectMode={() => console.log("onToggleSelectMode called")} 
        onDeleteSelected={() => console.log("onDeleteSelected called")} 
        onMoveSelected={() => console.log("onMoveSelected called")} 
      />
    </div>
  );
}