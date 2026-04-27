type ContentType = 'memo' | 'schedule';

interface ContentTypeTabsProps {
  activeType?: ContentType;
}

const tabs: Array<{ id: ContentType; label: string }> = [
  { id: 'memo', label: '메모' },
  { id: 'schedule', label: '일정' },
];

export function ContentTypeTabs({ activeType = 'memo' }: ContentTypeTabsProps) {
  return (
    <div className="tab-list" role="tablist" aria-label="콘텐츠 유형">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeType === tab.id ? 'tab-active' : ''}`}
          role="tab"
          aria-selected={activeType === tab.id}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
