import styles from './copilot.module.css';

export default function CopilotLoading() {
  return (
    <main className={styles.loadingPage} aria-label="Loading BeRight Copilot">
      <div className={styles.loadingShell}>
        <div className={styles.loadingHeader} />
        <div className={styles.loadingMessage} />
        <div className={styles.loadingMessageShort} />
      </div>
    </main>
  );
}
