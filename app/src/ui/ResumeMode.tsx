import { Mark } from './common';

/**
 * The home end of the seminar loop (PRD §5.2). Reached when the app is opened with
 * `?resume=CODE` — i.e. someone scanned the QR on the printed seminar card. Mirrors
 * the card's back copy ("Finish your plan at home") and drops the lead straight into
 * the full readiness flow.
 *
 * Honest-prototype note: there is no backend to restore a seminar-started profile
 * from another device, so this continues into a fresh full check rather than
 * pretending to rehydrate server state. The code is shown as the token it is.
 */
export function ResumeMode({ code, onContinue }: { code: string; onContinue: () => void }) {
  return (
    <div className="stage">
      <div className="intro">
        <div className="avatar" style={{ width: 46, height: 46, margin: '6px auto 16px' }}>
          <Mark size={26} />
        </div>
        <h1>Finish your plan at home</h1>
        <p>
          You started your Family Readiness File at the seminar. Let's finish it — about five minutes — to get your
          full plan, plus what to ask about emergency transport coverage.
        </p>
        <div className="previewmeter">
          <div className="t">Resuming from your card</div>
          <div className="pill-row">
            <span className="pill">Resume code · {code}</span>
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={onContinue}>
          Continue my plan →
        </button>
        <div className="disc">
          Helping a parent? You can finish Mom or Dad's plan with them from here too. SAM offers guidance, not
          medical advice. In an emergency, always call 911.
        </div>
      </div>
    </div>
  );
}
