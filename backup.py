INTERACTIVE_SCHEDULE_BACKUP = r'''
// Original interactive schedule feature backup from src/App.jsx

const [showSchedule, setShowSchedule] = useState(false);
const [scheduleRoomId, setScheduleRoomId] = useState(() => INITIAL_ROOMS[0]?.id || '');
const [expandedScheduleKey, setExpandedScheduleKey] = useState('');

const activeScheduleRoom = rooms.find((room) => room.id === scheduleRoomId) || rooms[0] || null;
const scheduleSections = useMemo(() => {
  if (!activeScheduleRoom || !Array.isArray(activeScheduleRoom.presentations)) return [];

  const grouped = activeScheduleRoom.presentations.reduce((acc, presentation) => {
    const sessionKey = presentation.session || 'Session';
    if (!acc[sessionKey]) {
      acc[sessionKey] = [];
    }
    acc[sessionKey].push(presentation);
    return acc;
  }, {});

  return Object.entries(grouped).map(([session, presentations]) => ({
    session,
    presentations,
  }));
}, [activeScheduleRoom]);

useEffect(() => {
  if (!rooms.length) return;
  if (!scheduleRoomId || !rooms.some((room) => room.id === scheduleRoomId)) {
    setScheduleRoomId(rooms[0].id);
  }
}, [rooms, scheduleRoomId]);

const handleOpenSchedule = useCallback(() => {
  setScheduleRoomId(selectedRoom || rooms[0]?.id || '');
  setExpandedScheduleKey('');
  setShowSchedule(true);
}, [rooms, selectedRoom]);

{showSchedule && (
  <div style={styles.overlay} onClick={() => setShowSchedule(false)}>
    <div
      style={{
        ...styles.modal,
        maxWidth: 760,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
        padding: isMobile ? '20px 16px 28px' : '24px 24px 30px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={styles.modalHeader}>
        <div>
          <div style={styles.modalTitle}>
            <CalendarDays size={20} color="#1d4ed8" />
            {t('scheduleModalTitle')}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6 }}>
            {t('scheduleTapHint')}
          </div>
        </div>
        <button
          type="button"
          aria-label="關閉"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          onClick={() => setShowSchedule(false)}
        >
          <X size={22} color="#666" />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 18 }}>
        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => {
              setScheduleRoomId(room.id);
              setExpandedScheduleKey('');
            }}
          >
            {room.id}
          </button>
        ))}
      </div>

      {activeScheduleRoom && scheduleSections.map((section) => (
        <div key={section.session}>
          {section.presentations.map((presentation) => {
            const scheduleKey = `${activeScheduleRoom.id}-${presentation.session}-${presentation.time}-${presentation.presenter}`;
            const isExpanded = expandedScheduleKey === scheduleKey;
            return (
              <button
                key={scheduleKey}
                type="button"
                onClick={() => setExpandedScheduleKey(isExpanded ? '' : scheduleKey)}
              >
                <div>{presentation.time}</div>
                <div>{presentation.presenter}</div>
                {isExpanded && (
                  <div>
                    <div>{presentation.topic}</div>
                    {!!presentation['實習'] && <div>{presentation['實習']}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  </div>
)}
'''