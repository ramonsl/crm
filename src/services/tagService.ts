/**
 * TagService - Centralized service for tag operations
 * 
 * Follows Single Responsibility Principle (SRP):
 * This service is responsible ONLY for tag-related operations.
 * It encapsulates the logic for finding, creating, and associating tags with leads.
 * 
 * Follows Open/Closed Principle (OCP):
 * New tag operations can be added without modifying existing methods.
 */

interface Tag {
    id: number;
    name: string;
    color: string;
}

interface TagOperationResult {
    success: boolean;
    tagId?: number;
    error?: string;
}

/**
 * Finds a tag by name from the list of available tags
 */
export async function findTagByName(tagName: string): Promise<Tag | null> {
    try {
        const response = await fetch('/api/tags');
        if (!response.ok) {
            console.error('[TagService] Failed to fetch tags');
            return null;
        }

        const data = await response.json();
        const tags: Tag[] = data.data || [];

        return tags.find(tag => tag.name === tagName) || null;
    } catch (error) {
        console.error('[TagService] Error finding tag:', error);
        return null;
    }
}

/**
 * Creates a new tag with the specified name and color
 */
export async function createTag(name: string, color: string = '#10b981'): Promise<Tag | null> {
    try {
        const response = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[TagService] Failed to create tag:', errorData);
            return null;
        }

        const data = await response.json();
        console.log(`[TagService] Tag created: ${data.data.id}`);
        return data.data;
    } catch (error) {
        console.error('[TagService] Error creating tag:', error);
        return null;
    }
}

/**
 * Associates a tag with a lead by CPF
 */
export async function associateTagWithLead(cpf: string, tagId: number): Promise<boolean> {
    try {
        const response = await fetch(`/api/leads/${cpf}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[TagService] Failed to associate tag:', errorData);
            return false;
        }

        console.log(`[TagService] Tag ${tagId} associated with lead ${cpf}`);
        return true;
    } catch (error) {
        console.error('[TagService] Error associating tag:', error);
        return false;
    }
}

/**
 * Main function: Finds or creates a tag and associates it with a lead
 * 
 * This is the high-level operation that orchestrates the lower-level functions.
 * It follows the "Tell, Don't Ask" principle by encapsulating all the decision logic.
 */
export async function addTagToLead(
    cpf: string,
    tagName: string,
    tagColor: string = '#10b981'
): Promise<TagOperationResult> {
    console.log(`[TagService] Adding tag "${tagName}" to lead ${cpf}...`);

    // Step 1: Try to find existing tag
    let tag = await findTagByName(tagName);

    // Step 2: Create tag if it doesn't exist
    if (!tag) {
        console.log(`[TagService] Tag "${tagName}" not found, creating...`);
        tag = await createTag(tagName, tagColor);

        if (!tag) {
            return {
                success: false,
                error: 'Failed to create tag'
            };
        }
    }

    // Step 3: Associate tag with lead
    const associated = await associateTagWithLead(cpf, tag.id);

    if (!associated) {
        return {
            success: false,
            tagId: tag.id,
            error: 'Failed to associate tag with lead'
        };
    }

    console.log(`[TagService] Tag "${tagName}" successfully added to lead ${cpf}`);
    return {
        success: true,
        tagId: tag.id
    };
}
