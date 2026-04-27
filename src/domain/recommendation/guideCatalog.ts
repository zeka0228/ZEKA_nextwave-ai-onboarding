import type { Recommendation, UserType } from '../types';

export const guideCatalog: Record<UserType, Recommendation[]> = {
  대학생: [
    {
      guideId: 'student_notification_rule',
      userType: '대학생',
      featureKey: 'notification_rule',
      title: '중요한 일정을 놓치지 않게 알림을 설정하세요',
      description: '시험, 과제 마감을 자동으로 리마인드 받을 수 있어요.',
      cta: '알림 설정하기',
      reason: '학업 일정과 마감 관리 맥락이 감지되었습니다.',
    },
  ],
  직장인: [
    {
      guideId: 'workmate_team_invite',
      userType: '직장인',
      featureKey: 'team_invite',
      title: '동료와 함께하면 더 편해요',
      description: '방금 만든 내용을 팀원에게 바로 공유할 수 있어요.',
      cta: '팀원 초대하기',
      reason: '회의, 업무, 공유 맥락이 감지되었습니다.',
    },
  ],
  프리랜서: [
    {
      guideId: 'freelancer_notification_rule',
      userType: '프리랜서',
      featureKey: 'notification_rule',
      title: '마감을 놓치지 않는 알림을 설정해보세요',
      description: '클라이언트 납품 일정을 자동으로 관리할 수 있어요.',
      cta: '알림 설정하기',
      reason: '클라이언트 또는 납품 일정 맥락이 감지되었습니다.',
    },
  ],
  '팀 사용자': [
    {
      guideId: 'team_notification_rule',
      userType: '팀 사용자',
      featureKey: 'notification_rule',
      title: '반복되는 알림을 자동화해 효율을 높이세요',
      description: '주간 회의, 정기 보고 알림을 자동 규칙으로 만들 수 있어요.',
      cta: '규칙 만들기',
      reason: '팀 협업과 반복 업무 맥락이 감지되었습니다.',
    },
  ],
  '개인 사용자': [
    {
      guideId: 'personal_note_share',
      userType: '개인 사용자',
      featureKey: 'note_share',
      title: '이 메모를 다른 사람과 공유할 수 있어요',
      description: '링크 하나로 팀원·지인에게 전달할 수 있어요.',
      cta: '메모 공유하기',
      reason: '명확한 업무 유형이 없어 기본 공유 기능을 추천합니다.',
    },
  ],
};
