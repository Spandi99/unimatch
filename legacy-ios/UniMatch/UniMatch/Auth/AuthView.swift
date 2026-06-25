import SwiftUI

struct AuthView: View {
    @Environment(AppState.self) private var appState
    @State private var selected: VerificationMethod = .switchEduID
    @State private var showLegiSheet = false

    var body: some View {
        VStack(spacing: Theme.sectionSpacing) {
            Spacer()

            // App name + icon
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Theme.accent)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "graduationcap.fill")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white)
                    )
                Text("UniMatch")
                    .font(.umTitle)
            }

            VStack(spacing: 6) {
                Text("Verify your student status")
                    .font(.umHeading)
                Text("One-time · takes 2 minutes")
                    .font(.umCaption)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                optionCard(
                    method: .switchEduID,
                    icon: "person.badge.key",
                    label: "SWITCH edu-ID",
                    sublabel: "Log in with your university SSO",
                    recommended: true
                )
                optionCard(
                    method: .legiCard,
                    icon: "creditcard",
                    label: "Photo of your Legi card",
                    sublabel: "Reviewed within 24h · deleted after"
                )
            }

            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "lock")
                    .font(.system(size: 12))
                Text("Legi photos are used for verification only and permanently deleted afterwards.")
            }
            .font(.umCaption)
            .foregroundStyle(.secondary)

            Spacer()

            Button("Continue") {
                if selected == .legiCard {
                    showLegiSheet = true
                } else {
                    verify()
                }
            }
            .buttonStyle(BlackCTAStyle())
        }
        .padding(.horizontal, Theme.screenPadding)
        .padding(.bottom, 24)
        .sheet(isPresented: $showLegiSheet) {
            legiConfirmationSheet
        }
    }

    private func verify() {
        appState.verificationMethod = selected
        withAnimation { appState.isVerified = true }
    }

    @ViewBuilder
    private func optionCard(method: VerificationMethod, icon: String, label: String, sublabel: String, recommended: Bool = false) -> some View {
        let isSelected = selected == method
        Button {
            selected = method
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(isSelected ? Theme.accent : Color(.label))
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(label).font(.umBody)
                        if recommended {
                            TagPill(text: "recommended", bg: Theme.uniTagBg, fg: Theme.uniTagText, size: 10)
                        }
                    }
                    Text(sublabel)
                        .font(.umCaption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(12)
            .background(isSelected ? Theme.uniTagBg : Color(.systemBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Theme.accent : Theme.separator, lineWidth: isSelected ? 1.5 : 0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private var legiConfirmationSheet: some View {
        VStack(spacing: Theme.sectionSpacing) {
            Spacer()
            Image(systemName: "checkmark.circle")
                .font(.system(size: 44))
                .foregroundStyle(Theme.accent)
            Text("Legi received — we'll verify within 24h.")
                .font(.umBody)
                .multilineTextAlignment(.center)
            Text("Your photo is used for verification only and permanently deleted afterwards.")
                .font(.umCaption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
            Button("Continue") {
                showLegiSheet = false
                verify()
            }
            .buttonStyle(BlackCTAStyle())
        }
        .padding(.horizontal, Theme.screenPadding)
        .padding(.bottom, 24)
        .presentationDetents([.medium])
    }
}

#Preview {
    AuthView().environment(AppState())
}
