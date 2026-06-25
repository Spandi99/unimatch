import SwiftUI

struct MatchesView: View {
    @Environment(AppState.self) private var appState
    @State private var expiredNames: [String] = []

    private let timestamps = ["2m", "1h", "3h", "yesterday", "2d"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
                if !expiredNames.isEmpty {
                    expiredBanner
                }
                replyNote
                newMatchesSection
                messagesSection
            }
            .padding(.horizontal, Theme.screenPadding)
            .padding(.vertical, 12)
        }
        .navigationTitle("Matches")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Drop anyone you've left hanging past the 48h reply deadline.
            let dropped = appState.evaluateAutoUnmatch()
            if !dropped.isEmpty { expiredNames = dropped }
        }
    }

    private var replyNote: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "clock").font(.system(size: 12))
            Text("Reply within 48h or the match expires. A first message that's just \"Hey\" unmatches you.")
        }
        .font(.umCaption)
        .foregroundStyle(.secondary)
    }

    private var expiredBanner: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "hourglass.bottomhalf.filled")
                .foregroundStyle(Theme.accent)
            Text("\(expiredNames.joined(separator: ", ")) expired — no reply within 48h.")
                .font(.umCaption)
                .foregroundStyle(Color(.label))
            Spacer()
        }
        .padding(12)
        .background(Theme.uniTagBg)
        .clipShape(RoundedRectangle(cornerRadius: Theme.buttonRadius))
    }

    private var newMatchesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("New matches")
                .font(.system(size: 16, weight: .medium))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(Array(appState.matches.prefix(5).enumerated()), id: \.element.id) { index, match in
                        VStack(spacing: 6) {
                            AvatarCircle(initials: match.profile.initials, tint: Theme.avatarTint(index), diameter: 56)
                                .overlay(alignment: .topTrailing) {
                                    Circle().fill(Theme.accent)
                                        .frame(width: 12, height: 12)
                                        .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 1.5))
                                }
                            Text("New match")
                                .font(.system(size: 10, weight: .regular))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var messagesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Messages")
                .font(.system(size: 16, weight: .medium))
            if appState.matches.isEmpty {
                Text("No conversations yet. Like someone in Discover to match.")
                    .font(.umCaption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            }
            VStack(spacing: 0) {
                ForEach(Array(appState.matches.enumerated()), id: \.element.id) { index, match in
                    NavigationLink {
                        ChatView(match: match, tintIndex: index)
                    } label: {
                        messageRow(match, index: index)
                    }
                    .buttonStyle(.plain)
                    if index < appState.matches.count - 1 {
                        HairlineDivider()
                    }
                }
            }
        }
    }

    private func messageRow(_ match: Match, index: Int) -> some View {
        HStack(spacing: 12) {
            AvatarCircle(initials: match.profile.initials, tint: Theme.avatarTint(index), diameter: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(match.profile.name)
                    .font(.system(size: 14, weight: .medium))
                Text(match.lastMessage ?? "You matched — say hi (but not just \"Hey\").")
                    .font(.umCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if match.awaitingYourReplySince != nil {
                Image(systemName: "exclamationmark.circle")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.accent)
            }
            Text(timestamps[index % timestamps.count])
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

#Preview {
    NavigationStack { MatchesView() }.environment(AppState())
}
