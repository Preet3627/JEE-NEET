// --- AFTER (recommended)
import { useAppStore } from '../store/useAppStore';

function StudentDashboard(props) {
  const scheduleItems = useAppStore(state => state.currentUser?.SCHEDULE_ITEMS || []);
  const studentConfig = useAppStore(state => state.currentUser?.CONFIG);

  // Effects should depend on scheduleItems (the store value) not on a detached 'student' prop
  useEffect(() => {
    // Alarms using scheduleItems
  }, [scheduleItems]);

  return (
    <div>
      <SubjectAllocationWidget items={scheduleItems} />
      <TodaysAgendaWidget items={scheduleItems} onStar={() => {}} />
      <ScheduleList items={scheduleItems} ... />
    </div>
  );
}