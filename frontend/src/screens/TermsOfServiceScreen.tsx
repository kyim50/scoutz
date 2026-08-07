import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography, borderRadius } from '../constants/theme';

interface TermsOfServiceScreenProps {
  navigation: any;
}

const APP_NAME = 'Cite';

export default function TermsOfServiceScreen({ navigation }: TermsOfServiceScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.surface,
        },
        header: {
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        headerTitle: {
          ...typography.h3,
          color: colors.text,
        },
        headerSpacer: {
          width: 40,
        },
        backButton: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        scroll: {
          flex: 1,
          backgroundColor: colors.surface,
        },
        content: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
        },
        introText: {
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        sectionTitle: {
          ...typography.subtitle,
          color: colors.text,
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        paragraph: {
          ...typography.body,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
          lineHeight: 20,
        },
        bulletList: {
          marginLeft: spacing.md,
          marginBottom: spacing.sm,
        },
        bulletItem: {
          flexDirection: 'row',
          marginBottom: spacing.xs,
        },
        bulletDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.textSecondary,
          marginTop: 7,
          marginRight: spacing.xs,
        },
        bulletText: {
          flex: 1,
          ...typography.body,
          color: colors.textSecondary,
          lineHeight: 20,
        },
      }),
    [colors, insets]
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const BulletList = ({ items }: { items: string[] }) => (
    <View style={styles.bulletList}>
      {items.map((item, idx) => (
        <View key={idx} style={styles.bulletItem}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introText}>
          This summary of our Terms of Service is provided for convenience and does not replace the
          full legal text below. These Terms are provided for general informational purposes only
          and do not constitute legal advice. You should consult your own legal counsel before
          relying on these Terms in a production environment.
        </Text>

        <Section title="1. Introduction">
          <Text style={styles.paragraph}>
            Welcome to {APP_NAME}, a community map app that helps people discover places, events,
            and reports around them. By accessing or using {APP_NAME} (the “Service”), you agree to
            be bound by these Terms of Service (the “Terms”). If you do not agree to these Terms,
            you may not use the Service.
          </Text>
          <Text style={styles.paragraph}>
            You must be at least 13 years old to use the Service. If you are using the Service on
            behalf of another person or organization, you represent that you are authorized to do
            so and that you agree to these Terms on their behalf.
          </Text>
        </Section>

        <Section title="2. Your account">
          <Text style={styles.paragraph}>
            To use certain features, you may need to create an account using an email address,
            username, and password or other sign-in method we support. You agree to provide accurate
            information and to keep it up to date.
          </Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your login credentials and
            for all activity that occurs under your account. You should notify us promptly if you
            believe your account has been compromised.
          </Text>
        </Section>

        <Section title="3. User content and behavior">
          <Text style={styles.paragraph}>
            The Service allows you and other users to create and share content, including pins,
            events, reports, reviews, photos, and other information (“User Content”). You retain
            ownership of your User Content, but by posting it on the Service you grant us a
            worldwide, non-exclusive, royalty-free, transferable license to host, store, use,
            display, reproduce, modify, and distribute your User Content as needed to operate,
            improve, and promote the Service.
          </Text>
          <Text style={styles.paragraph}>
            You are responsible for the User Content you post and for your interactions with other
            users. You agree that you will not post any User Content or otherwise use the Service in
            ways that:
          </Text>
          <BulletList
            items={[
              'Are illegal, harmful, fraudulent, or misleading.',
              'Promote hate, harassment, threats, or discrimination.',
              'Contain nudity, sexual content involving minors, or graphic violence.',
              'Violate the rights of others, including privacy, publicity, or intellectual property rights.',
              'Include spam, scams, or unauthorized commercial messages.',
            ]}
          />
          <Text style={styles.paragraph}>
            We may, but are not obligated to, review, moderate, or remove User Content and may
            suspend or terminate accounts that violate these Terms or that we believe pose a risk to
            other users or to the Service.
          </Text>
        </Section>

        <Section title="4. Location and safety">
          <Text style={styles.paragraph}>
            Many features of {APP_NAME} rely on location data, including your device location and
            locations provided by other users. Pins, events, and reports may be user-generated and
            can be incomplete, outdated, or inaccurate. We do not guarantee the accuracy or
            reliability of any location data or User Content.
          </Text>
          <Text style={styles.paragraph}>
            Always exercise your own judgment and prioritize your safety when deciding whether to
            visit a place or act on information you see in the app. Do not use the Service for
            emergency response or life-safety situations; contact your local emergency services
            instead.
          </Text>
        </Section>

        <Section title="5. Acceptable use">
          <Text style={styles.paragraph}>You agree that you will not, and will not attempt to:</Text>
          <BulletList
            items={[
              'Use the Service for any unlawful purpose or in violation of any applicable law.',
              'Access or use the Service in a way that could damage, disable, overburden, or impair our systems.',
              'Scrape, crawl, or harvest data from the Service without our prior written consent.',
              'Reverse engineer, decompile, or otherwise attempt to derive source code from the Service except where permitted by law.',
              'Circumvent any access controls, security measures, or usage limits we put in place.',
            ]}
          />
        </Section>

        <Section title="6. Third-party services">
          <Text style={styles.paragraph}>
            The Service may integrate with third-party services, such as map providers, analytics
            tools, or cloud platforms. Your use of those services may be subject to additional terms
            and privacy policies provided by those third parties. We are not responsible for the
            content or practices of third-party services.
          </Text>
        </Section>

        <Section title="7. Termination">
          <Text style={styles.paragraph}>
            You may stop using {APP_NAME} at any time. We may suspend or terminate your access to
            the Service (including your account) at our discretion, including if we reasonably
            believe that you have violated these Terms, created risk or legal exposure for us or
            other users, or for operational reasons.
          </Text>
          <Text style={styles.paragraph}>
            Upon termination, your right to use the Service will immediately cease. Some provisions
            of these Terms, such as those related to User Content licenses, disclaimers, and
            limitations of liability, will continue to apply.
          </Text>
        </Section>

        <Section title="8. Disclaimers">
          <Text style={styles.paragraph}>
            The Service is provided on an “as is” and “as available” basis. To the fullest extent
            permitted by law, we disclaim all warranties, express or implied, including warranties
            of merchantability, fitness for a particular purpose, and non-infringement.
          </Text>
          <Text style={styles.paragraph}>
            We do not warrant that the Service will be uninterrupted, secure, or free of errors, or
            that any content, including location information or User Content, will be accurate or
            reliable.
          </Text>
        </Section>

        <Section title="9. Limitation of liability">
          <Text style={styles.paragraph}>
            To the fullest extent permitted by law, we will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or for any loss of profits or
            revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill,
            or other intangible losses, resulting from your use of or inability to use the Service.
          </Text>
          <Text style={styles.paragraph}>
            Where our liability cannot be excluded under applicable law, it will be limited to the
            amount you have paid us (if any) for use of the Service during the six months prior to
            the event giving rise to the claim.
          </Text>
        </Section>

        <Section title="10. Changes to these Terms">
          <Text style={styles.paragraph}>
            We may update these Terms from time to time, for example to reflect changes to the
            Service or applicable laws. When we make material changes, we will take reasonable steps
            to notify you, such as updating the “last updated” date, providing in-app notices, or
            sending an email if we have your contact information.
          </Text>
          <Text style={styles.paragraph}>
            Your continued use of the Service after the updated Terms become effective constitutes
            your acceptance of the changes.
          </Text>
        </Section>

        <Section title="11. Contact">
          <Text style={styles.paragraph}>
            If you have questions about these Terms, you can contact us at{' '}
            <Text style={{ fontWeight: '600', color: colors.text }}>
              kimanimac56@gmail.com
            </Text>
            .
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

