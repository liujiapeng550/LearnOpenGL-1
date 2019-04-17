#version 330 core
out vec4 FragColor;

in VS_OUT {
    vec3 FragPos;
    vec2 TexCoords;
    vec3 TangentLightPos;
    vec3 TangentViewPos;
    vec3 TangentFragPos;
    vec3 T;
    vec3 B;
    vec3 N;
    vec3 lightPos;
    vec3 viewPos;
} fs_in;

uniform sampler2D diffuseMap;
uniform sampler2D normalMap;
uniform sampler2D depthMap;

uniform float heightScale;

vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{ 
    float height =  texture(depthMap, texCoords).r;     
    return texCoords - viewDir.xy * (height * heightScale);        
}


float ray_intersect_rm(    // use linear and binary search
	in sampler2D heightmap,
	in vec2 dp,
	in vec2 ds)
{
	const int linear_search_steps=200;
	const int binary_search_steps=20;

	// current size of search window
	float size = 1.0/float(linear_search_steps);
	// current depth position
	float depth = 0.0;
	// search front to back for first point inside object
	for( int i=0;i<linear_search_steps;i++ )
	{
		float t = texture(heightmap,dp+ds*depth).r;

		if (depth<(1.0-t))
			depth += size;
	}
	// recurse around first point (depth) for closest match
	for( int ii=0;ii<binary_search_steps;ii++ )
	{
		size*=0.5;
		float t = texture(heightmap,dp+ds*depth).r;
		if (depth<(1.0-t))
			depth += (2.0*size);
		depth -= size;
	}
	return depth;
}

vec2 updateUV(
 sampler2D heightmap,
 vec3 pointToCameraDirWS,
 vec3 n,
 vec3 t,
 vec3 b,
 float Depth,
 vec2 uv,
 vec2 uvScale,
 float tiling)
{
    if (Depth > 0.0)
    {
    float a = dot(n,-pointToCameraDirWS);
        vec3 s = vec3(
            dot(pointToCameraDirWS,t),
            dot(pointToCameraDirWS,b),
            a);
        s *= Depth/a*0.01;
        vec2 ds = s.xy*uvScale;
        uv = uv*tiling*uvScale;
        float d = ray_intersect_rm(heightmap,uv,ds);
        return uv+ds*d;
    }
    else return uv*tiling*uvScale;
}

void main()
{           
    // offset texture coordinates with Parallax Mapping
    vec3 viewDir = normalize(fs_in.TangentViewPos - fs_in.TangentFragPos);
    vec2 texCoords = fs_in.TexCoords;
    
//    texCoords = ParallaxMapping(fs_in.TexCoords,  viewDir);       

    vec3 pointToCameraDirWS =normalize(fs_in.viewPos - fs_in.FragPos);

    texCoords=updateUV(depthMap,pointToCameraDirWS,fs_in.N,fs_in.T,fs_in.B,10.0,fs_in.TexCoords,vec2(1.0,1.0),1.0);



    if(texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;

    // obtain normal from normal map
    vec3 normal = texture(normalMap, texCoords).rgb;
    normal = normalize(normal * 2.0 - 1.0);   
   
    // get diffuse color
    vec3 color = texture(diffuseMap, texCoords).rgb;
    // ambient
    vec3 ambient = 0.1 * color;
    // diffuse
    vec3 lightDir = normalize(fs_in.TangentLightPos - fs_in.TangentFragPos);
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * color;
    // specular    
    vec3 reflectDir = reflect(-lightDir, normal);
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);

    vec3 specular = vec3(0.2) * spec;
    FragColor = vec4(ambient + diffuse + specular, 1.0);
}