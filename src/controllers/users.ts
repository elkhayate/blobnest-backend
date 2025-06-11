import { Response } from "express";
import { UserRequest } from "../types";
import { supabaseAdmin } from "../services/supabase";
import logger from "../config/logger";
import {
  createUserSchema,
  updateUserSchema,
  getUsersQuerySchema,
  userIdParamsSchema,
  updateUserInfoSchema,
  updateCompanyInfoSchema,
} from "../validations/users";

export const getUsers = async (req: UserRequest, res: Response) => {
  try {
    const queryResult = getUsersQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ error: queryResult.error.format() });
    }

    const { search, role, page, rowsPerPage } = queryResult.data;

    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let filteredUsers = allUsers.filter(user => 
      user.user_metadata?.company_id === authUser.user_metadata?.company_id &&
      user.id !== authUser.id
    );

    if (search) {
      filteredUsers = filteredUsers.filter(user => 
        user.email?.toLowerCase().includes(search.toLowerCase()) || 
        user.user_metadata?.display_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (role && ["admin", "uploader", "viewer"].indexOf(role) !== -1) {
      filteredUsers = filteredUsers.filter(user => 
        user.user_metadata?.role === role
      );
    }

    const total = filteredUsers.length;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedUsers = filteredUsers.slice(start, end);

    const formattedUsers = paginatedUsers.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.user_metadata?.role,
      display_name: user.user_metadata?.display_name,
      company_name: user.user_metadata?.company_name,
      company_id: user.user_metadata?.company_id
    }));

    res.json({
      users: formattedUsers,
      total,
      page,
      rowsPerPage,
      totalPages: Math.ceil(total / rowsPerPage)
    });

  } catch (error) {
    logger.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const createUser = async (req: UserRequest, res: Response) => {
  try {
    const validationResult = createUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.format() });
    }

    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { email, password, role, display_name } = validationResult.data;

    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        display_name,
        company_name: authUser.user_metadata?.company_name,
        company_id: authUser.user_metadata?.company_id
      }
    });

    if (authError) throw authError;
    if (!user) throw new Error("User creation failed");

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role,
        display_name: user.user_metadata?.display_name,
        company_name: user.user_metadata?.company_name,
        company_id: user.user_metadata?.company_id
      }
    });
  } catch (error) {
    logger.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
};

export const updateUser = async (req: UserRequest, res: Response) => {
  try {
    const paramsResult = userIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({ error: paramsResult.error.format() });
    }

    const validationResult = updateUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.format() });
    }

    const { userId } = paramsResult.data;
    const { email, role, display_name } = validationResult.data;

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError) throw getUserError;
    if (!user) throw new Error("User not found");

    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (user.user_metadata?.company_id !== authUser.user_metadata?.company_id) {
      return res.status(403).json({ error: "Cannot update user from different company" });
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    
    const updatedMetadata = {
      ...user.user_metadata,
      ...(role && { role }),
      ...(display_name && { display_name }),
      company_name: user.user_metadata?.company_name,
      company_id: user.user_metadata?.company_id
    };

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        ...updateData,
        user_metadata: updatedMetadata
      }
    );

    if (updateError) throw updateError;

    res.json({ message: "User updated successfully" });
  } catch (error) {
    logger.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

export const deleteUser = async (req: UserRequest, res: Response) => {
  try {
    const paramsResult = userIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({ error: paramsResult.error.format() });
    }

    const { userId } = paramsResult.data;

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError) throw getUserError;
    if (!user) throw new Error("User not found");

    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (user.user_metadata?.company_id !== authUser.user_metadata?.company_id) {
      return res.status(403).json({ error: "Cannot delete user from different company" });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    logger.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const getUserAndCompanyInfo = async (req: UserRequest, res: Response) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(authUser.id);
    if (getUserError) throw getUserError;
    if (!user) throw new Error("User not found");

    if(user.user_metadata?.role !== "admin"){
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.user_metadata?.role,
          display_name: user.user_metadata?.display_name,
        },
        company: null
      });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "User has no associated company" });
    }

    let { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (companyError && companyError.code !== 'PGRST116') { 
      throw companyError;
    }

    if (!company) {
      const { data: newCompany, error: createError } = await supabaseAdmin
        .from('companies')
        .insert({
          company_id: companyId,
          company_name: user.user_metadata?.company_name
        })
        .select()
        .single();

      if (createError) throw createError;
      company = newCompany;
    }

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role,
        display_name: user.user_metadata?.display_name,
      },
      company
    });

  } catch (error) {
    logger.error("Error getting user and company info:", error);
    res.status(500).json({ error: "Failed to get user and company info", message: error });
  }
}

export const updateUserInfo = async (req: UserRequest, res: Response) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validationResult = updateUserInfoSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.format() });
    }

    const { email, display_name } = validationResult.data;

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      {
        email,
        user_metadata: { display_name }
      }
    );

    if (updateError) throw updateError;

    res.json({ message: "User info updated successfully" });
  } catch (error) {
    logger.error("Error updating user info:", error);
    res.status(500).json({ error: "Failed to update user info", message: error });
  }
}

export const updateCompanyInfo = async (req: UserRequest, res: Response) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validationResult = updateCompanyInfoSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.format() });
    }

    const { storage_account_name, sas_token } = validationResult.data; 

    const { error: updateError } = await supabaseAdmin.from('companies').update({
      storage_account_name,
      sas_token
    }).eq('company_id', authUser.user_metadata?.company_id);

    if (updateError) throw updateError;

    res.json({ message: "Company info updated successfully" });
  } catch (error) {
    logger.error("Error updating company info:", error);
    res.status(500).json({ error: "Failed to update company info", message: error });
  }
}