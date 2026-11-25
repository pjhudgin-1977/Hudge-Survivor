import { formatSeasonRecord, type TeamRecords } from "@/lib/teamRecords";
import styles from "./TeamRecordLabel.module.css";

export default function TeamRecordLabel({
  team,
  records,
  prefix,
}: {
  team: string;
  records: TeamRecords;
  prefix?: string;
}) {
  const record = formatSeasonRecord(team, records);

  return (
    <span className={styles.label}>
      <span>{prefix}{team}</span>
      {record && <small className={styles.record}>({record})</small>}
    </span>
  );
}
