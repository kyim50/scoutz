import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography, borderRadius } from '../constants/theme';

interface PrivacyPolicyScreenProps {
  navigation: any;
}

const APP_NAME = 'Cite';

export default function PrivacyPolicyScreen({ navigation }: PrivacyPolicyScreenProps) {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introText}>
          This Privacy Policy explains how we collect, use, and share information when you use
          {` `}{APP_NAME}. It is provided for general informational purposes only and does not
          constitute legal advice. You should consult your own legal counsel before relying on this
          Policy in a production environment.
        </Text>

        <Section title="1. Information we collect">
          <Text style={styles.paragraph}>
            We collect information in a few different ways when you use {APP_NAME}:
          </Text>
          <BulletList
            items={[
              'Account information: such as your email address, name, username, and password or authentication tokens.',
              'Profile details: such as a display name, avatar, or other optional profile details you choose to provide.',
              'Location information: approximate or precise location from your device (when you grant permission) and locations you add to pins, events, or reports.',
              'User content: including pins, events, reports, reviews, comments, and photos or media you upload.',
              'Usage and device information: such as IP address, device type, operating system, app version, crash logs, and how you interact with the app (for example, screens viewed and basic feature usage).',
            ]}
          />
        </Section>

        <Section title="2. How we use information">
          <Text style={styles.paragraph}>We use the information we collect to:</Text>
          <BulletList
            items={[
              'Provide and maintain the Service, including authentication, saving your preferences, and showing you relevant pins, events, and reports.',
              'Operate location-based features, such as surfacing nearby content or mapping community activity.',
              'Promote safety and integrity by detecting, preventing, and responding to abuse, spam, or harmful behavior.',
              'Analyze usage and improve the Service, including performance, design, and new features.',
              'Communicate with you about updates, security alerts, support messages, and important changes to the Service.',
            ]}
          />
        </Section>

        <Section title="3. Legal bases for processing (where applicable)">
          <Text style={styles.paragraph}>
            Where data protection laws require a legal basis (such as in the European Union), we
            rely on the following:
          </Text>
          <BulletList
            items={[
              'Performance of a contract: to provide the Service you sign up for, including core functionality like accounts, maps, and saving content.',
              'Legitimate interests: to keep the Service secure, prevent abuse, understand usage patterns, and improve the app in ways that are proportionate and respect your rights.',
              'Consent: for certain optional uses, such as enabling location services on your device or receiving certain communications, where required by law.',
              'Legal obligations: to comply with applicable laws, regulations, or legal processes.',
            ]}
          />
        </Section>

        <Section title="4. How we share information">
          <Text style={styles.paragraph}>
            We do not sell your personal information. We may share information as follows:
          </Text>
          <BulletList
            items={[
              'With service providers that help us operate the Service, such as hosting providers, databases, analytics, logging, and error monitoring tools.',
              'With infrastructure providers we rely on for storage, authentication, and media (for example, cloud platforms or storage services).',
              'With map, geolocation, or routing providers to display maps and location-based content.',
              'With analytics providers to understand how the Service is used and to improve performance and reliability.',
              'When required by law, regulation, or legal process, or to protect the rights, property, or safety of {APP_NAME}, our users, or others.',
              'In aggregated or de-identified form that does not reasonably identify you, for research, reporting, or improving the Service.',
            ].map((item) => item.replace('{APP_NAME}', APP_NAME))}
          />
        </Section>

        <Section title="5. International transfers">
          <Text style={styles.paragraph}>
            The Service may be operated from and information may be processed in countries other
            than the one where you live. These countries may have different data protection laws
            than your own. Where required, we take steps to help protect your information in
            accordance with applicable law, such as using contractual protections for data
            transfers.
          </Text>
        </Section>

        <Section title="6. Data retention">
          <Text style={styles.paragraph}>
            We retain your information for as long as necessary to provide the Service and to
            comply with legal obligations, resolve disputes, and enforce our agreements. In general:
          </Text>
          <BulletList
            items={[
              'Account information is kept while you have an active account. If you delete your account, we may keep limited information for a period of time for security, backup, or legal reasons.',
              'User content such as pins, events, and reports may remain available to other users even after you delete your account, unless you delete that content before closing your account or we remove it as part of moderation.',
              'Logs and analytics data are kept for a limited time to help us operate and improve the Service.',
            ]}
          />
        </Section>

        <Section title="7. Your choices and rights">
          <Text style={styles.paragraph}>
            Depending on your location and applicable law, you may have certain rights over your
            personal information, such as:
          </Text>
          <BulletList
            items={[
              'Accessing a copy of the personal information we hold about you.',
              'Requesting corrections to inaccurate information.',
              'Requesting deletion of certain information, subject to legal and operational limits.',
              'Objecting to or restricting certain processing activities.',
              'Withdrawing consent where we rely on your consent to process information.',
            ]}
          />
          <Text style={styles.paragraph}>
            You can exercise some of these rights directly in the app, for example by editing your
            profile or deleting content you have posted. For other requests, you can contact us at{' '}
            <Text style={{ fontWeight: '600', color: colors.text }}>
              kimanimac56@gmail.com
            </Text>
            . We may need to verify your identity before responding.
          </Text>
        </Section>

        <Section title="8. Children">
          <Text style={styles.paragraph}>
            {APP_NAME} is not directed to children under 13, and we do not knowingly collect
            personal information from children under 13. If you believe that a child under 13 has
            provided us with personal information, please contact us so we can take appropriate
            steps, such as deleting the information or closing the account.
          </Text>
        </Section>

        <Section title="9. Changes to this Policy">
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. When we make material changes, we
            will take reasonable steps to notify you, such as updating the “last updated” date,
            showing an in-app notice, or sending an email if we have your contact information.
          </Text>
          <Text style={styles.paragraph}>
            Your continued use of the Service after the updated Policy becomes effective constitutes
            your acceptance of the changes.
          </Text>
        </Section>

        <Section title="10. Contact">
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy or how your information is handled, you
            can contact us at{' '}
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

