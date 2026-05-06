import "server-only";
import { Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export type UserBlockedProps = {
  name: string;
  reason?: string;
  supportEmail?: string;
};

export function UserBlockedEmail({
  name,
  reason,
  supportEmail,
}: UserBlockedProps) {
  const firstName = name?.split(" ")[0] || "there";
  return (
    <EmailLayout
      preview="Your EduMeet account access has been suspended"
      heading="Your account has been suspended"
    >
      <Text style={styles.paragraph}>Hi {firstName},</Text>
      <Text style={styles.paragraph}>
        An administrator has temporarily suspended your EduMeet account. While
        suspended you won&apos;t be able to sign in or join classes.
      </Text>
      {reason && (
        <Section style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Reason</Text>
          <Text style={styles.noteText}>{reason}</Text>
        </Section>
      )}
      <Text style={styles.paragraph}>
        If you believe this is a mistake, contact our team
        {supportEmail ? (
          <>
            {" "}
            at <strong>{supportEmail}</strong>
          </>
        ) : null}{" "}
        so we can review.
      </Text>
    </EmailLayout>
  );
}
