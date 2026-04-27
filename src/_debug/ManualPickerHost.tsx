import { useEffect, useState } from 'react';
import './picker.css';
import { useAppState } from '../app/AppStateProvider';
import type { ClassificationInput, UserType } from '../domain/types';
import type { ClassificationOutcome } from '../services/classifiers/classificationFlow';
import { registerPicker, unregisterPicker } from './pickerBridge';

type Step = 'primary' | 'secondary' | 'select_user_type';
type PickedSource = 'mock_classifier' | 'history_fallback';

interface ActiveRequest {
  input: ClassificationInput;
  resolve: (outcome: ClassificationOutcome) => void;
}

const SUCCESS_USER_TYPES: UserType[] = [
  '대학생',
  '직장인',
  '프리랜서',
  '팀 사용자',
];

function buildDefaultFallback(): ClassificationOutcome {
  return {
    userType: '개인 사용자',
    source: 'default_fallback',
    confidence: 0,
    keywords: [],
    rawUserType: 'unknown',
    reasoning: '[수동] default fallback 으로 강제 분류',
  };
}

function buildSuccessOutcome(
  userType: UserType,
  source: PickedSource,
): ClassificationOutcome {
  return {
    userType,
    source,
    confidence: 0.87,
    keywords: ['수동', '선택'],
    rawUserType: userType === '개인 사용자' ? 'unknown' : userType,
    reasoning: `[수동] ${source} 경로로 ${userType} 선택`,
  };
}

export function ManualPickerHost() {
  const { actions } = useAppState();
  const [request, setRequest] = useState<ActiveRequest | null>(null);
  const [step, setStep] = useState<Step>('primary');
  const [pendingSource, setPendingSource] = useState<PickedSource>(
    'mock_classifier',
  );

  useEffect(() => {
    registerPicker(
      (input) =>
        new Promise<ClassificationOutcome>((resolve) => {
          setStep('primary');
          setRequest({ input, resolve });
        }),
    );
    return () => unregisterPicker();
  }, []);

  if (!request) return null;

  const finish = (outcome: ClassificationOutcome) => {
    request.resolve(outcome);
    setRequest(null);
  };

  const onPrimary = (choice: 'success' | 'fail1' | 'fail2') => {
    if (choice === 'success') {
      setPendingSource('mock_classifier');
      setStep('select_user_type');
      return;
    }
    if (choice === 'fail1') {
      setStep('secondary');
      return;
    }
    finish(buildDefaultFallback());
  };

  const onSecondary = (choice: 'history_success' | 'fail2') => {
    if (choice === 'history_success') {
      setPendingSource('history_fallback');
      setStep('select_user_type');
      return;
    }
    finish(buildDefaultFallback());
  };

  const onSelectUserType = (userType: UserType) => {
    finish(buildSuccessOutcome(userType, pendingSource));
  };

  const back = () => {
    setStep((prev) => (prev === 'select_user_type' || prev === 'secondary' ? 'primary' : prev));
  };

  const onResetPersistence = () => {
    const confirmed = window.confirm(
      '♚♚사용자☆콘텐츠☆대시보드☆dismiss♚♚ 이력☜☜이 $$모두$$ ※초기화됩니다.☏☎☏☎ \n새♬로♬고♬침♬ 없이 ☞☞즉시☜☜ 적♥용. §§진행할까요?§§',
    );
    if (!confirmed) return;
    // 진행 중이던 picker 의 promise 는 일부러 resolve 하지 않음.
    // submitContent 가 await 에서 매달려있게 두면 reset 결과가 ANALYSIS_RESOLVED 로
    // 덮어쓰여질 race 가 사라짐. 매달린 frame 은 다음 GC 사이클에서 정리됨.
    setRequest(null);
    actions.resetState();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card debug-picker-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow debug-eyebrow">DEBUG · 수동 분류</p>
            <h2>분류 결과 직접 선택</h2>
          </div>
          <button
            className="ghost-button debug-reset-button"
            type="button"
            onClick={onResetPersistence}
            title="localStorage 를 비우고 페이지를 새로고침합니다"
          >
            영속 초기화
          </button>
        </div>

        <div className="debug-input-summary">
          <span className="debug-input-label">입력</span>
          <strong>{request.input.title}</strong>
          <span className="debug-input-body">{request.input.content}</span>
        </div>

        {step === 'primary' && (
          <div className="debug-picker-options">
            <p className="debug-picker-prompt">분류 시나리오를 선택하세요.</p>
            <button
              className="primary-button debug-picker-button"
              type="button"
              onClick={() => onPrimary('success')}
            >
              <strong>성공</strong>
              <span>LLM 분류 채택 → user_type 직접 선택</span>
            </button>
            <button
              className="ghost-button debug-picker-button"
              type="button"
              onClick={() => onPrimary('fail1')}
            >
              <strong>실패1</strong>
              <span>LLM 저신뢰도/unknown → 다음 단계로</span>
            </button>
            <button
              className="ghost-button debug-picker-button"
              type="button"
              onClick={() => onPrimary('fail2')}
            >
              <strong>실패2</strong>
              <span>즉시 default fallback (개인 사용자)</span>
            </button>
          </div>
        )}

        {step === 'secondary' && (
          <div className="debug-picker-options">
            <p className="debug-picker-prompt">
              실패1 → 사용 이력 폴백 결과는?
            </p>
            <button
              className="primary-button debug-picker-button"
              type="button"
              onClick={() => onSecondary('history_success')}
            >
              <strong>사용이력 성공</strong>
              <span>history_fallback 으로 user_type 직접 선택</span>
            </button>
            <button
              className="ghost-button debug-picker-button"
              type="button"
              onClick={() => onSecondary('fail2')}
            >
              <strong>실패2</strong>
              <span>이력도 없음 → default fallback</span>
            </button>
            <button
              className="ghost-button debug-picker-back"
              type="button"
              onClick={back}
            >
              ← 처음으로
            </button>
          </div>
        )}

        {step === 'select_user_type' && (
          <div className="debug-picker-options">
            <p className="debug-picker-prompt">
              최종 user_type 선택 (source: <code>{pendingSource}</code>)
            </p>
            {SUCCESS_USER_TYPES.map((type) => (
              <button
                key={type}
                className="ghost-button debug-picker-button"
                type="button"
                onClick={() => onSelectUserType(type)}
              >
                {type}
              </button>
            ))}
            <button
              className="ghost-button debug-picker-back"
              type="button"
              onClick={back}
            >
              ← 처음으로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
