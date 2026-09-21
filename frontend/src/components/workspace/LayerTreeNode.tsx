import { useEffect, useRef, useState } from "react";
import {
    ChevronRight,
    ChevronDown,
    MoreVertical,
    GripVertical,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import {
    useSortable,
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { computeLayerCheckboxState } from "@/lib/workspace/tree";
import {
    getFeatureDisplayName,
    getLayerDisplayName,
} from "@/lib/workspace/featureDisplay";
import type {
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "@/lib/workspace/types";
import type { WorkspaceSelection } from "./StyleEditorPanel";

export interface LayerTreeNodeProps {
    layer: WorkspaceLayer;
    depth: number;
    activeLayerId: string | null;
    selection?: WorkspaceSelection;
    readOnly?: boolean;
    onSelectLayer: (layerId: string) => void;
    onSelectMembership: (membershipId: string) => void;
    onMoveMembership: (membershipId: string) => void;
    onDuplicateMembership: (membershipId: string) => void;
}

const selectedRowClass = "bg-brand-primary/10";
const activeLayerRowClass = "bg-brand-primary/5";

const menuItemClass =
    "cursor-pointer rounded px-2 py-1.5 text-sm text-color-text-primary outline-none hover:bg-color-surface-bg";
const dangerMenuItemClass =
    "cursor-pointer rounded px-2 py-1.5 text-sm text-status-critical-text outline-none hover:bg-color-surface-bg";

export function LayerTreeNode({
    layer,
    depth,
    activeLayerId,
    selection = null,
    readOnly = false,
    onSelectLayer,
    onSelectMembership,
    onMoveMembership,
    onDuplicateMembership,
}: LayerTreeNodeProps) {
    const [isExpanded, setExpanded] = useState(true);
    const [isRenaming, setRenaming] = useState(false);
    const [draftName, setDraftName] = useState(layer.name ?? "");
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isRenaming) return;
        const timeoutId = setTimeout(() => renameInputRef.current?.focus(), 0);
        return () => clearTimeout(timeoutId);
    }, [isRenaming]);

    const layers = useWorkspaceStore((s) => s.layers);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const features = useWorkspaceStore((s) => s.features);
    const addLayer = useWorkspaceStore((s) => s.addLayer);
    const renameLayer = useWorkspaceStore((s) => s.renameLayer);
    const deleteLayer = useWorkspaceStore((s) => s.deleteLayer);
    const toggleLayerVisibility = useWorkspaceStore(
        (s) => s.toggleLayerVisibility,
    );

    const childLayers = layers
        .filter((l) => l.parentId === layer.id)
        .sort((a, b) => a.order - b.order);
    const ownMemberships = memberships
        .filter((m) => m.layerId === layer.id)
        .sort((a, b) => a.order - b.order);
    const featureById = new Map(features.map((f) => [f.id, f]));
    const checkboxState = computeLayerCheckboxState(
        layers,
        memberships,
        layer.id,
    );
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: layer.id });
    const sortableStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const isSelected =
        selection?.kind === "layer" && selection.layerId === layer.id;
    const isActiveLayer = activeLayerId === layer.id;

    function commitRename() {
        renameLayer(layer.id, draftName.trim());
        setRenaming(false);
    }

    return (
        <li className="list-none" ref={setNodeRef} style={sortableStyle}>
            <div
                className={`flex min-h-9 items-center gap-1 pr-2 ${isSelected ? selectedRowClass : isActiveLayer ? activeLayerRowClass : ""}`}
                style={{ paddingLeft: `${depth * 16}px` }}
            >
                {!readOnly && (
                    <button
                        type="button"
                        aria-label={`Reorder ${getLayerDisplayName(layer)}`}
                        {...attributes}
                        {...listeners}
                        className="flex size-5 shrink-0 cursor-grab items-center justify-center touch-none active:cursor-grabbing"
                    >
                        <GripVertical className="size-4 text-color-text-secondary" />
                    </button>
                )}
                <button
                    type="button"
                    aria-label={isExpanded ? "Collapse layer" : "Expand layer"}
                    onClick={() => setExpanded((v) => !v)}
                    className="flex size-5 shrink-0 items-center justify-center"
                >
                    {childLayers.length + ownMemberships.length > 0 &&
                        (isExpanded ? (
                            <ChevronDown className="size-4" />
                        ) : (
                            <ChevronRight className="size-4" />
                        ))}
                </button>

                <Checkbox
                    checked={checkboxState !== "unchecked"}
                    indeterminate={checkboxState === "indeterminate"}
                    onChange={(e) =>
                        toggleLayerVisibility(layer.id, e.target.checked)
                    }
                    aria-label={`Toggle visibility for ${getLayerDisplayName(layer)}`}
                />

                {isRenaming ? (
                    <input
                        ref={renameInputRef}
                        value={draftName}
                        placeholder={getLayerDisplayName(layer)}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="min-w-0 flex-1 rounded border border-color-border bg-color-surface-bg px-1 text-sm"
                    />
                ) : (
                    <button
                        type="button"
                        aria-current={isSelected ? "true" : undefined}
                        onClick={() => onSelectLayer(layer.id)}
                        className={`min-w-0 flex-1 truncate text-left text-sm font-semibold ${
                            activeLayerId === layer.id
                                ? "text-brand-primary"
                                : "text-color-text-primary"
                        }`}
                    >
                        {getLayerDisplayName(layer)}
                    </button>
                )}

                {!readOnly && (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                aria-label={`Options for ${getLayerDisplayName(layer)}`}
                                className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-color-surface-bg"
                            >
                                <MoreVertical className="size-4" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="end"
                                onCloseAutoFocus={(e) => e.preventDefault()}
                                className="z-[var(--z-dropdown)] w-48 rounded-md border border-color-border bg-color-surface-raised p-1 shadow-md"
                            >
                                <DropdownMenu.Item
                                    className={menuItemClass}
                                    onSelect={() => {
                                        setDraftName(layer.name ?? "");
                                        setRenaming(true);
                                    }}
                                >
                                    Rename
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className={menuItemClass}
                                    onSelect={() =>
                                        addLayer(undefined, layer.id)
                                    }
                                >
                                    Add child layer
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className={dangerMenuItemClass}
                                    onSelect={() => deleteLayer(layer.id)}
                                >
                                    Delete layer
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}
            </div>

            {isExpanded && (
                <ul className="m-0 list-none p-0">
                    <SortableContext
                        items={ownMemberships.map((m) => m.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {ownMemberships.map((membership) => {
                            const feature = featureById.get(
                                membership.featureId,
                            );
                            if (!feature) return null;
                            return (
                                <MembershipRow
                                    key={membership.id}
                                    membership={membership}
                                    feature={feature}
                                    depth={depth}
                                    readOnly={readOnly}
                                    isSelected={
                                        selection?.kind === "membership" &&
                                        selection.membershipId === membership.id
                                    }
                                    onSelectMembership={onSelectMembership}
                                    onMoveMembership={onMoveMembership}
                                    onDuplicateMembership={
                                        onDuplicateMembership
                                    }
                                />
                            );
                        })}
                    </SortableContext>

                    <SortableContext
                        items={childLayers.map((l) => l.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {childLayers.map((child) => (
                            <LayerTreeNode
                                key={child.id}
                                layer={child}
                                depth={depth + 1}
                                activeLayerId={activeLayerId}
                                selection={selection}
                                readOnly={readOnly}
                                onSelectLayer={onSelectLayer}
                                onSelectMembership={onSelectMembership}
                                onMoveMembership={onMoveMembership}
                                onDuplicateMembership={onDuplicateMembership}
                            />
                        ))}
                    </SortableContext>
                </ul>
            )}
        </li>
    );
}

interface MembershipRowProps {
    membership: WorkspaceMembership;
    feature: WorkspaceFeature;
    depth: number;
    readOnly: boolean;
    isSelected: boolean;
    onSelectMembership: (membershipId: string) => void;
    onMoveMembership: (membershipId: string) => void;
    onDuplicateMembership: (membershipId: string) => void;
}

function MembershipRow({
    membership,
    feature,
    depth,
    readOnly,
    isSelected,
    onSelectMembership,
    onMoveMembership,
    onDuplicateMembership,
}: MembershipRowProps) {
    const [isRenaming, setRenaming] = useState(false);
    const [draftName, setDraftName] = useState(getFeatureDisplayName(feature));
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isRenaming) return;
        const timeoutId = setTimeout(() => renameInputRef.current?.focus(), 0);
        return () => clearTimeout(timeoutId);
    }, [isRenaming]);

    const renameFeature = useWorkspaceStore((s) => s.renameFeature);
    const toggleMembershipVisibility = useWorkspaceStore(
        (s) => s.toggleMembershipVisibility,
    );
    const removeMembership = useWorkspaceStore((s) => s.removeMembership);
    const deleteFeature = useWorkspaceStore((s) => s.deleteFeature);
    const isDuplicated = useWorkspaceStore(
        (s) =>
            s.memberships.filter((m) => m.featureId === feature.id).length > 1,
    );
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: membership.id });
    const sortableStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const displayName = getFeatureDisplayName(feature);

    function commitRename() {
        renameFeature(feature.id, draftName.trim() || displayName);
        setRenaming(false);
    }

    return (
        <li
            ref={setNodeRef}
            className={`flex min-h-8 items-center gap-1 pr-2 ${isSelected ? selectedRowClass : ""}`}
            style={{ ...sortableStyle, paddingLeft: `${(depth + 1) * 16}px` }}
        >
            {!readOnly && (
                <button
                    type="button"
                    aria-label={`Reorder ${displayName}`}
                    {...attributes}
                    {...listeners}
                    className="flex size-5 shrink-0 cursor-grab items-center justify-center touch-none active:cursor-grabbing"
                >
                    <GripVertical className="size-4 text-color-text-secondary" />
                </button>
            )}
            <span className="size-5 shrink-0" />
            <Checkbox
                checked={membership.visible}
                onChange={(e) =>
                    toggleMembershipVisibility(membership.id, e.target.checked)
                }
                aria-label={`Toggle visibility for ${displayName} feature`}
            />

            {isRenaming ? (
                <input
                    ref={renameInputRef}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="min-w-0 flex-1 rounded border border-color-border bg-color-surface-bg px-1 text-sm"
                />
            ) : (
                <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => onSelectMembership(membership.id)}
                    className={`min-w-0 flex-1 truncate text-left text-sm ${
                        isSelected
                            ? "font-semibold text-color-text-primary"
                            : "text-color-text-secondary"
                    }`}
                >
                    {displayName}
                </button>
            )}
            {!readOnly && (
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button
                            type="button"
                            aria-label="Feature options"
                            className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-color-surface-bg"
                        >
                            <MoreVertical className="size-4" />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            align="end"
                            onCloseAutoFocus={(e) => e.preventDefault()}
                            className="z-[var(--z-dropdown)] w-48 rounded-md border border-color-border bg-color-surface-raised p-1 shadow-md"
                        >
                            <DropdownMenu.Item
                                className={menuItemClass}
                                onSelect={() => {
                                    setDraftName(displayName);
                                    setRenaming(true);
                                }}
                            >
                                Rename
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className={menuItemClass}
                                onSelect={() =>
                                    onDuplicateMembership(membership.id)
                                }
                            >
                                Duplicate to another layer
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className={menuItemClass}
                                onSelect={() => onMoveMembership(membership.id)}
                            >
                                Move to layer
                            </DropdownMenu.Item>
                            {isDuplicated && (
                                <DropdownMenu.Item
                                    className={menuItemClass}
                                    onSelect={() =>
                                        removeMembership(membership.id)
                                    }
                                >
                                    Remove from this layer
                                </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Item
                                className={dangerMenuItemClass}
                                onSelect={() => deleteFeature(feature.id)}
                            >
                                Delete feature everywhere
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            )}
        </li>
    );
}
