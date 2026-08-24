import styles from './capital.module.css';

export default function CapitalLoading() {
  return (
    <main className={styles.routeLoading} aria-label="Loading BeRight Capital">
      <div className={styles.routeLoadingInner}>
        <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
        <div className={styles.skeletonHero} />
        <div className={styles.routeLoadingGrid}>
          <div className={styles.skeletonPanel} />
          <div className={styles.skeletonPanel} />
        </div>
      </div>
    </main>
  );
}
