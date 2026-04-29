import type { ContentType } from '../../domain/types';

interface ContentFormProps {
  type: ContentType;
  title: string;
  body: string;
  date: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onDateChange: (value: string) => void;
}

export function ContentForm({
  type,
  title,
  body,
  date,
  onTitleChange,
  onBodyChange,
  onDateChange,
}: ContentFormProps) {
  const isSchedule = type === 'schedule';

  return (
    <div className="form-grid">
      <label className="form-field">
        <span>제목</span>
        <input
          type="text"
          placeholder={isSchedule ? '월요일 09:00 전사 회의' : '회의 준비'}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>내용</span>
        <textarea
          rows={5}
          placeholder={
            isSchedule
              ? '본사 1층 대회의실 / 분기 KPI 리뷰'
              : '팀원들과 공유할 내용을 정리해보세요'
          }
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
        />
      </label>
      {isSchedule && (
        <label className="form-field">
          <span>날짜</span>
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>
      )}
    </div>
  );
}
