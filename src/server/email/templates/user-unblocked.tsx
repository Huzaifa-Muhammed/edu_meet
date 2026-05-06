import "server-only";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export type UserUnblockedProps = {
  name: string;
  loginUrl: string;
};

export function UserUnblockedEmail({ name, loginUrl }: UserUnblockedProps) {
  const firstName = name?.split(" ")[0] || "there";
  return (
    <EmailLayout
      preview="Your EduMeet account has been reinstated"
      heading="Welcome back"
    >
      <Text style={styles.paragraph}>Hi {firstName},</Text>
      <Text style={styles.paragraph}>
        Your EduMeet account has been reinstated. You can sign in and pick up
        where you left off.
      </Text>
      <Section style={styles.buttonWrap}>
        <Button href={loginUrl} style={styles.button}>
          Sign in
        </Button>
      </Section>
    </EmailLayout>
  );
}
