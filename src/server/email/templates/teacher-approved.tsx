import "server-only";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export type TeacherApprovedProps = {
  name: string;
  loginUrl: string;
  customMessage?: string;
};

export function TeacherApprovedEmail({
  name,
  loginUrl,
  customMessage,
}: TeacherApprovedProps) {
  const firstName = name?.split(" ")[0] || "there";
  return (
    <EmailLayout
      preview="Your EduMeet teacher application has been approved"
      heading="You're approved 🎉"
    >
      <Text style={styles.paragraph}>Hi {firstName},</Text>
      <Text style={styles.paragraph}>
        Great news — an admin has approved your teacher application. You now
        have full access to the EduMeet teacher portal: create classes, host
        live sessions, and manage your students.
      </Text>
      {customMessage && (
        <Section style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Note from the team</Text>
          <Text style={styles.noteText}>{customMessage}</Text>
        </Section>
      )}
      <Section style={styles.buttonWrap}>
        <Button href={loginUrl} style={styles.button}>
          Open the teacher portal
        </Button>
      </Section>
      <Text style={styles.hint}>
        If the button doesn&apos;t work, copy and paste this link into your
        browser: {loginUrl}
      </Text>
    </EmailLayout>
  );
}
