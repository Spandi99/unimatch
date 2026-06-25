import SwiftUI

// MARK: - Design system tokens

enum Theme {
    // Colors
    static let accent = Color(red: 0.325, green: 0.290, blue: 0.718)

    static let background = Color(.systemBackground)
    static let surface = Color(.secondarySystemBackground)
    static let separator = Color(.separator)
    static let label = Color(.label)

    // Distance pill (green)
    static let distancePillBg = Color(red: 0.882, green: 0.957, blue: 0.933)
    static let distancePillText = Color(red: 0.031, green: 0.314, blue: 0.255)

    // University tag (purple)
    static let uniTagBg = Color(red: 0.933, green: 0.929, blue: 0.996)
    static let uniTagText = Color(red: 0.235, green: 0.204, blue: 0.537)

    // Avatar tint cycle
    static let avatarTints: [Color] = [
        Color(red: 0.933, green: 0.929, blue: 0.996), // purple
        Color(red: 0.984, green: 0.922, blue: 0.906), // pink
        Color(red: 0.882, green: 0.957, blue: 0.933), // green
        Color(red: 0.992, green: 0.953, blue: 0.871), // amber
    ]

    static func avatarTint(_ index: Int) -> Color {
        avatarTints[index % avatarTints.count]
    }

    // Layout
    static let screenPadding: CGFloat = 16
    static let cardRadius: CGFloat = 16
    static let buttonRadius: CGFloat = 10
    static let sectionSpacing: CGFloat = 24
}

// MARK: - Typography helpers
// Heaviest weight used anywhere is .medium. Sentence case everywhere.

extension Font {
    static let umTitle = Font.system(size: 22, weight: .medium)
    static let umHeading = Font.system(size: 18, weight: .medium)
    static let umBody = Font.system(size: 16, weight: .regular)
    static let umCaption = Font.system(size: 13, weight: .regular)
    static let umButton = Font.system(size: 14, weight: .medium)
}

// MARK: - Reusable button styles

struct BlackCTAStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.umButton)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(Color(.systemBackground))
            .background(Color(.label))
            .clipShape(RoundedRectangle(cornerRadius: Theme.buttonRadius))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

struct OutlinedCTAStyle: ButtonStyle {
    var destructive: Bool = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.umButton)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(destructive ? Color.red : Color(.label))
            .background(Color(.systemBackground))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.buttonRadius)
                    .stroke(destructive ? Color.red : Color(.label), lineWidth: 1.5)
            )
            .opacity(configuration.isPressed ? 0.6 : 1)
    }
}

// MARK: - Small shared views

struct HairlineDivider: View {
    var body: some View {
        Rectangle()
            .frame(height: 0.5)
            .foregroundStyle(Theme.separator)
    }
}

struct TagPill: View {
    let text: String
    let bg: Color
    let fg: Color
    var size: CGFloat = 10

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: .medium))
            .foregroundStyle(fg)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bg)
            .clipShape(Capsule())
    }
}

struct AvatarCircle: View {
    let initials: String
    let tint: Color
    var diameter: CGFloat = 34
    var showOnlineDot: Bool = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(tint)
                .frame(width: diameter, height: diameter)
                .overlay(
                    Text(initials)
                        .font(.system(size: diameter * 0.38, weight: .medium))
                        .foregroundStyle(Theme.uniTagText)
                )
            if showOnlineDot {
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 1.5))
            }
        }
    }
}
