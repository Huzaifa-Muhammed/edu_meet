import "server-only";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export type TeacherRejectedProps = {
  name: string;
  reapplyUrl: string;
  reviewNote?: string;
};

export function TeacherRejectedEmail({
  name,
  reapplyUrl,
  reviewNote,
}: TeacherRejectedProps) {
  const firstName = name?.split(" ")[0] || "there";
  return (
    <EmailLayout
      preview="Update on your EduMeet teacher application"
      heading="Application update"
    >
      <Text style={styles.paragraph}>Hi {firstName},</Text>
      <Text style={styles.paragraph}>
        Thanks for applying to teach on EduMeet. After review, we&apos;re unable
        to approve your application as it stands. You&apos;re welcome to update
        the details below and resubmit.
      </Text>
      {reviewNote && (
        <Section style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Reviewer note</Text>
          <Text style={styles.noteText}>{reviewNote}</Text>
        </Section>
      )}
      <Section style={styles.buttonWrap}>
        <Button href={reapplyUrl} style={styles.button}>
          Update my application
        </Button>
      </Section>
      <Text style={styles.hint}>
        If you have questions, just reply to this email and someone from the
        team will get back to you.
      </Text>
    </EmailLayout>
  );
}
